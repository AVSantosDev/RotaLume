from rest_framework.views import APIView
from rest_framework.response import Response

from .models import PropostaTemplate


def _tpl():
    return PropostaTemplate.objects.get_or_create(singleton_key="global")[0]


class PropostaTemplateApiView(APIView):
    def get(self, request):
        t = _tpl()
        return Response(
            {
                "empresa_nome": t.empresa_nome,
                "titulo": t.titulo,
                "email_comercial": t.email_comercial,
                "telefone_comercial": t.telefone_comercial,
                "logo_data_url": t.logo_data_url,
                "condicoes_comerciais": t.condicoes_comerciais,
                "atualizado_em": t.atualizado_em.isoformat() if t.atualizado_em else None,
            }
        )

    def patch(self, request):
        t = _tpl()
        d = request.data or {}
        if "empresa_nome" in d:
            t.empresa_nome = str(d.get("empresa_nome") or "")[:120]
        if "titulo" in d:
            t.titulo = str(d.get("titulo") or "")[:120]
        if "email_comercial" in d:
            t.email_comercial = str(d.get("email_comercial") or "")[:160]
        if "telefone_comercial" in d:
            t.telefone_comercial = str(d.get("telefone_comercial") or "")[:80]
        if "logo_data_url" in d:
            # Expect data URL: data:image/png;base64,... (ou jpeg)
            raw = str(d.get("logo_data_url") or "")
            # limite para evitar payload gigante acidental
            t.logo_data_url = raw[:2_000_000] if raw else ""
        if "condicoes_comerciais" in d:
            t.condicoes_comerciais = str(d.get("condicoes_comerciais") or "")
        t.save()
        return self.get(request)

