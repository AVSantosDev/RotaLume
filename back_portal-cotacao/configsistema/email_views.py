from __future__ import annotations

import base64
import re
import smtplib
from email.message import EmailMessage

import requests
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import EmailEnvioConfiguracao


def _cfg():
    return EmailEnvioConfiguracao.objects.get_or_create(singleton_key="global")[0]


def _is_email(v: str) -> bool:
    if not v:
        return False
    v = v.strip()
    return bool(re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", v))


class EmailEnvioConfigApiView(APIView):
    def get(self, request):
        c = _cfg()
        return Response(
            {
                "habilitado": bool(c.habilitado),
                "modo_envio": getattr(c, "modo_envio", "AUTH"),
                "remetente_nome": c.remetente_nome,
                "remetente_email": c.remetente_email,
                "smtp_host": c.smtp_host,
                "smtp_port": c.smtp_port,
                "smtp_usuario": c.smtp_usuario,
                "smtp_use_tls": bool(c.smtp_use_tls),
                "relay_ip_publico": getattr(c, "relay_ip_publico", ""),
                # nunca devolve senha
                "senha_configurada": bool(c.smtp_senha and c.smtp_senha.strip()),
                "atualizado_em": c.atualizado_em.isoformat() if c.atualizado_em else None,
            }
        )

    def patch(self, request):
        c = _cfg()
        d = request.data or {}

        if "habilitado" in d:
            c.habilitado = bool(d.get("habilitado"))
        if "modo_envio" in d:
            modo = str(d.get("modo_envio") or "").strip().upper()
            c.modo_envio = modo if modo in {"AUTH", "RELAY"} else "AUTH"
        if "remetente_nome" in d:
            c.remetente_nome = str(d.get("remetente_nome") or "")[:120]
        if "remetente_email" in d:
            c.remetente_email = str(d.get("remetente_email") or "")[:160]
        if "smtp_host" in d:
            c.smtp_host = str(d.get("smtp_host") or "")[:255]
        if "smtp_port" in d:
            try:
                c.smtp_port = int(d.get("smtp_port") or 587)
            except Exception:
                c.smtp_port = 587
        if "smtp_usuario" in d:
            c.smtp_usuario = str(d.get("smtp_usuario") or "")[:255]
        if "smtp_senha" in d:
            # só atualiza se vier preenchida
            senha = str(d.get("smtp_senha") or "").strip()
            if senha:
                c.smtp_senha = senha
        if "smtp_use_tls" in d:
            c.smtp_use_tls = bool(d.get("smtp_use_tls"))
        if "relay_ip_publico" in d:
            c.relay_ip_publico = str(d.get("relay_ip_publico") or "")[:64]

        c.save()
        return self.get(request)


class EnviarPropostaEmailApiView(APIView):
    def post(self, request):
        c = _cfg()
        if not c.habilitado:
            return Response({"error": "Envio de e-mail desabilitado em Configurações."}, status=status.HTTP_400_BAD_REQUEST)

        d = request.data or {}
        to_email = str(d.get("to") or "").strip()
        subject = str(d.get("subject") or "").strip()[:240]
        body = str(d.get("body") or "").strip()

        filename = str(d.get("filename") or "Proposta_Comercial.pdf")[:160]
        pdf_b64 = str(d.get("pdf_base64") or "").strip()

        if not _is_email(to_email):
            return Response({"error": "Informe um e-mail válido do cliente (Para)."}, status=status.HTTP_400_BAD_REQUEST)
        if not subject:
            return Response({"error": "Assunto é obrigatório."}, status=status.HTTP_400_BAD_REQUEST)
        if not pdf_b64:
            return Response({"error": "PDF não recebido."}, status=status.HTTP_400_BAD_REQUEST)

        if not c.smtp_host:
            return Response({"error": "SMTP não configurado (host)."}, status=status.HTTP_400_BAD_REQUEST)

        from_email = (c.remetente_email or c.smtp_usuario or "").strip()
        if not _is_email(from_email):
            return Response({"error": "Remetente e-mail inválido (configure em E-mail)."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            pdf_bytes = base64.b64decode(pdf_b64.encode("utf-8"), validate=True)
        except Exception:
            return Response({"error": "PDF base64 inválido."}, status=status.HTTP_400_BAD_REQUEST)

        msg = EmailMessage()
        msg["To"] = to_email
        msg["From"] = f"{c.remetente_nome} <{from_email}>" if c.remetente_nome else from_email
        msg["Subject"] = subject
        msg.set_content(body or "Segue proposta comercial em anexo.")
        msg.add_attachment(pdf_bytes, maintype="application", subtype="pdf", filename=filename)

        try:
            modo = (getattr(c, "modo_envio", "AUTH") or "AUTH").upper()
            use_tls = bool(c.smtp_use_tls)

            with smtplib.SMTP(c.smtp_host, int(c.smtp_port or (587 if use_tls else 25)), timeout=20) as s:
                s.ehlo()
                if use_tls:
                    s.starttls()
                    s.ehlo()
                if modo == "AUTH":
                    if not c.smtp_usuario or not c.smtp_senha:
                        return Response({"error": "SMTP AUTH selecionado, mas usuário/senha não configurados."}, status=status.HTTP_400_BAD_REQUEST)
                    s.login(c.smtp_usuario, c.smtp_senha)
                s.send_message(msg)
        except Exception as e:
            return Response({"error": f"Falha ao enviar e-mail: {e}"}, status=status.HTTP_502_BAD_GATEWAY)

        return Response({"ok": True})


class EmailEgressIpApiView(APIView):
    """
    Retorna o IP público de saída do servidor (egress).
    Útil para configurar o conector SMTP Relay no Microsoft 365.
    """

    def get(self, request):
        try:
            r = requests.get("https://api.ipify.org?format=json", timeout=8)
            r.raise_for_status()
            data = r.json()
            ip = (data.get("ip") or "").strip()
            if not ip:
                return Response({"error": "Não foi possível detectar o IP."}, status=status.HTTP_502_BAD_GATEWAY)
            return Response({"ip_publico": ip})
        except Exception as e:
            return Response({"error": f"Falha ao detectar IP público: {e}"}, status=status.HTTP_502_BAD_GATEWAY)

