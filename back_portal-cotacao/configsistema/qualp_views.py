from __future__ import annotations

import logging
from datetime import timedelta

import requests
from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import QualpCacheRota, QualpConfiguracao, QualpConsultaHistorico
from .qualp_service import extrair_piso_e_carga_descarga, post_rotas_v4, post_tabela_frete, somar_pedagios_por_eixo

logger = logging.getLogger(__name__)


def _cfg():
    return QualpConfiguracao.objects.get_or_create(singleton_key='global')[0]


def _norm_od(cidade: str, uf: str) -> str:
    c = ' '.join((cidade or '').split()).upper()
    u = (uf or '').strip().upper()[:2]
    return f'{c}, {u}'


def _serialize_antt_resolution(antt_res: dict) -> tuple[str, str]:
    nome = ((antt_res or {}).get('name') or '')[:255]
    url = ((antt_res or {}).get('url') or '')[:500]
    return nome, url


class QualpConfigApiView(APIView):
    def get(self, request):
        c = _cfg()
        return Response(
            {
                'api_base_url': c.api_base_url,
                'eixos_padrao': c.eixos_padrao,
                'tipo_carga_padrao': c.tipo_carga_padrao,
                'tipo_tabela_frete_padrao': c.tipo_tabela_frete_padrao,
                'retorno_vazio_padrao': c.retorno_vazio_padrao,
                'validade_cache_dias': c.validade_cache_dias,
                'token_configurado': bool(c.access_token and c.access_token.strip()),
            }
        )

    def patch(self, request):
        c = _cfg()
        data = request.data or {}
        if 'api_base_url' in data and data['api_base_url']:
            c.api_base_url = str(data['api_base_url']).strip()
        if 'access_token' in data:
            token = (data.get('access_token') or '').strip()
            if token:
                c.access_token = token
        if 'eixos_padrao' in data:
            c.eixos_padrao = int(data['eixos_padrao'])
        if 'tipo_carga_padrao' in data:
            c.tipo_carga_padrao = str(data['tipo_carga_padrao']).strip()
        if 'tipo_tabela_frete_padrao' in data:
            c.tipo_tabela_frete_padrao = str(data['tipo_tabela_frete_padrao']).strip().upper()[:1]
        if 'retorno_vazio_padrao' in data:
            c.retorno_vazio_padrao = bool(data['retorno_vazio_padrao'])
        if 'validade_cache_dias' in data:
            c.validade_cache_dias = max(1, min(366, int(data['validade_cache_dias'])))
        c.save()
        return self.get(request)


class QualpConsultaApiView(APIView):
    def post(self, request):
        c = _cfg()
        token = (c.access_token or '').strip()
        if not token:
            return Response(
                {'error': 'Access-Token QualP não configurado. Acesse Configuração sistema → QualP.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        d = request.data or {}
        cidade_o = (d.get('origem') or '').strip()
        uf_o = (d.get('uf_origem') or '').strip().upper()
        cidade_d = (d.get('destino') or '').strip()
        uf_d = (d.get('uf_destino') or '').strip().upper()

        if not cidade_o or not uf_o or not cidade_d or not uf_d:
            return Response(
                {'error': 'Informe origem, UF origem, destino e UF destino (cidade completa).'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        loc_a = _norm_od(cidade_o, uf_o)
        loc_b = _norm_od(cidade_d, uf_d)

        axis = int(d.get('axis') or c.eixos_padrao)
        if axis < 2 or axis > 9:
            return Response({'error': 'Número de eixos deve estar entre 2 e 9.'}, status=status.HTTP_400_BAD_REQUEST)

        freight_type = (d.get('freight_type') or c.tipo_tabela_frete_padrao or 'A').strip().upper()
        if freight_type not in {'A', 'B', 'C', 'D'}:
            return Response({'error': 'Tabela de frete inválida (use A, B, C ou D).'}, status=status.HTTP_400_BAD_REQUEST)

        load_type = (d.get('load_type') or c.tipo_carga_padrao or 'geral').strip()
        is_empty = bool(d.get('is_empty_return', c.retorno_vazio_padrao))
        retro_raw = (d.get('retroactive_date') or '').strip()
        retro = retro_raw or ''

        salvar_historico = bool(d.get('salvar_historico', True))
        salvar_cache = bool(d.get('salvar_cache', True))
        forcar_busca_api = bool(d.get('forcar_busca_api', False))

        now = timezone.now()
        dias = max(1, min(366, int(c.validade_cache_dias or 30)))

        if not forcar_busca_api:
            hit = (
                QualpCacheRota.objects.filter(
                    origem_texto=loc_a,
                    destino_texto=loc_b,
                    freight_type=freight_type,
                    load_type=load_type,
                    eixos=axis,
                    retorno_vazio=is_empty,
                    retroactive_date=retro,
                    valido_ate__gte=now,
                )
                .order_by('-consultado_em')
                .first()
            )
            if hit:
                ar_nome = hit.resolucao_antt_nome
                ar_url = hit.resolucao_antt_url
                antt_res = {'name': ar_nome, 'url': ar_url} if (ar_nome or ar_url) else {}
                return Response(
                    {
                        'fonte_cache': True,
                        'consultado_em': hit.consultado_em.isoformat(),
                        'valido_ate': hit.valido_ate.isoformat(),
                        'distancia_km': float(hit.distancia_km),
                        'distancia_texto': hit.distancia_texto or None,
                        'pedagio_total': float(hit.pedagio_total),
                        'frete_antt_minimo': float(hit.frete_antt_referencia),
                        'carga_descarga_antt': float(hit.carga_descarga_antt),
                        'tabela_frete_usada': freight_type,
                        'tipo_carga_usada': load_type,
                        'eixos': axis,
                        'retorno_vazio': is_empty,
                        'id_transacao': hit.id_transacao_qualp,
                        'antt_resolution': antt_res,
                        'link_site_qualp': hit.link_site_qualp or None,
                        'label_antt_resolution': ar_nome or '',
                    }
                )

        base = c.api_base_url or 'https://api.qualp.com.br'

        try:
            rr = post_rotas_v4(base, token, [loc_a, loc_b], axis)
        except requests.RequestException as e:
            logger.exception('QualP rotas rede')
            return Response({'error': f'Falha de rede ao consultar rota QualP: {e}'}, status=status.HTTP_502_BAD_GATEWAY)

        if rr.status_code == 401:
            return Response({'error': 'QualP retornou 401 — verifique o Access-Token.'}, status=status.HTTP_401_UNAUTHORIZED)
        if rr.status_code >= 400:
            try:
                det = rr.json()
            except Exception:
                det = {'raw': rr.text[:800]}
            return Response({'error': 'Erro ao calcular rota na QualP.', 'detalhes': det}, status=rr.status_code)

        try:
            rota_js = rr.json()
        except Exception:
            return Response({'error': 'Resposta QualP (rota) não é JSON.'}, status=status.HTTP_502_BAD_GATEWAY)

        principal = rota_js['rotas'][0] if isinstance(rota_js, dict) and rota_js.get('rotas') else rota_js
        if not isinstance(principal, dict):
            return Response({'error': 'Formato de resposta QualP (rota) inesperado.'}, status=status.HTTP_502_BAD_GATEWAY)

        distancia = principal.get('distancia') or {}
        km = distancia.get('valor')
        if km is None:
            return Response({'error': 'QualP não retornou distância (valor).'}, status=status.HTTP_502_BAD_GATEWAY)

        pedagios = principal.get('pedagios') or []
        pedagio_total = somar_pedagios_por_eixo(pedagios, axis)

        id_trans = principal.get('id_transacao')
        distancia_texto_fmt = distancia.get('texto') or ''

        retro_date_api = retro if retro else None
        try:
            fr = post_tabela_frete(
                base,
                token,
                float(km),
                axis,
                freight_type,
                load_type,
                is_empty,
                retro_date_api,
            )
        except requests.RequestException as e:
            logger.exception('QualP tabela frete rede')
            return Response(
                {'error': f'Rota OK, mas falha de rede na tabela ANTT: {e}'},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        if fr.status_code == 401:
            return Response({'error': 'QualP (tabela frete) 401 — verifique o Access-Token.'}, status=status.HTTP_401_UNAUTHORIZED)
        if fr.status_code >= 400:
            try:
                det = fr.json()
            except Exception:
                det = {'raw': fr.text[:800]}
            return Response(
                {
                    'error': 'Erro ao consultar tabela de frete ANTT na QualP.',
                    'detalhes': det,
                    'parcial': {
                        'distancia_km': float(km),
                        'pedagio_total': float(pedagio_total),
                        'id_transacao': id_trans,
                    },
                },
                status=fr.status_code,
            )

        try:
            tf_js = fr.json()
        except Exception:
            return Response({'error': 'Resposta QualP (tabela frete) não é JSON.'}, status=status.HTTP_502_BAD_GATEWAY)

        freight_cost, load_unload_val = extrair_piso_e_carga_descarga(tf_js)
        if freight_cost is None:
            ck = tf_js.get('costs')
            costs_keys = list(ck.keys())[:40] if isinstance(ck, dict) else None
            logger.warning(
                'QualP tabela frete: piso não reconhecido no JSON. Topo: %s · '
                'costs keys: %s',
                list(tf_js.keys())[:24],
                costs_keys,
            )
        load_unload = load_unload_val if load_unload_val is not None else 0
        antt_res = tf_js.get('antt_resolution') or {}
        res_nome, res_url = _serialize_antt_resolution(antt_res)

        consultado_em = now
        valido_ate = now + timedelta(days=dias)

        if salvar_cache:
            try:
                QualpCacheRota.objects.update_or_create(
                    defaults={
                        'consultado_em': consultado_em,
                        'valido_ate': valido_ate,
                        'distancia_km': km,
                        'pedagio_total': pedagio_total,
                        'frete_antt_referencia': freight_cost if freight_cost is not None else 0,
                        'carga_descarga_antt': load_unload,
                        'resolucao_antt_nome': res_nome,
                        'resolucao_antt_url': res_url[:500],
                        'id_transacao_qualp': id_trans,
                        'link_site_qualp': (principal.get('link_site_qualp') or '')[:500],
                        'distancia_texto': distancia_texto_fmt[:64],
                    },
                    origem_texto=loc_a,
                    destino_texto=loc_b,
                    freight_type=freight_type,
                    load_type=load_type,
                    eixos=axis,
                    retorno_vazio=is_empty,
                    retroactive_date=retro,
                )
            except Exception:
                logger.exception('Falha ao atualizar QualpCacheRota')

        if salvar_historico:
            try:
                QualpConsultaHistorico.objects.create(
                    origem_texto=loc_a,
                    destino_texto=loc_b,
                    distancia_km=km,
                    pedagio_total=pedagio_total,
                    frete_antt_referencia=freight_cost if freight_cost is not None else 0,
                    carga_descarga_antt=load_unload,
                    tabela_antt=freight_type,
                    tipo_carga_antt=load_type,
                    eixos=axis,
                    resolucao_antt_nome=res_nome,
                    resolucao_antt_url=res_url[:200],
                    id_transacao_qualp=id_trans,
                )
            except Exception:
                logger.exception('Falha ao gravar QualpConsultaHistorico')

        nome_resposta = antt_res.get('name')
        dt_resposta = antt_res.get('date')
        label_res_txt = ' · '.join(x for x in [nome_resposta, dt_resposta] if x)

        return Response(
            {
                'fonte_cache': False,
                'consultado_em': consultado_em.isoformat(),
                'valido_ate': valido_ate.isoformat(),
                'distancia_km': float(km),
                'distancia_texto': distancia_texto_fmt or None,
                'pedagio_total': float(pedagio_total),
                'frete_antt_minimo': float(freight_cost) if freight_cost is not None else None,
                'carga_descarga_antt': float(load_unload) if load_unload is not None else None,
                'tabela_frete_usada': freight_type,
                'tipo_carga_usada': load_type,
                'eixos': axis,
                'retorno_vazio': is_empty,
                'id_transacao': id_trans,
                'antt_resolution': antt_res,
                'link_site_qualp': principal.get('link_site_qualp'),
                'label_antt_resolution': label_res_txt,
            }
        )
