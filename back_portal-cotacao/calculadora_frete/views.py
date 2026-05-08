from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from .calc_engine import calcular_rapido


class CalculadoraFreteRapidaView(APIView):
    """
    POST JSON — custo_ctrb, markup_pct (%).

    frete_valor = custo * (1 + markup/100)
    """

    authentication_classes: list = []
    permission_classes: list = []

    def post(self, request):
        body = request.data if isinstance(request.data, dict) else {}
        out = calcular_rapido(body)
        if not out.get("ok"):
            return Response(out, status=status.HTTP_400_BAD_REQUEST)
        return Response(out, status=status.HTTP_200_OK)
