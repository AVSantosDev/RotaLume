from django.urls import path

from .views import CalculadoraFreteRapidaView

urlpatterns = [
    path("rapida/", CalculadoraFreteRapidaView.as_view(), name="calculadora-frete-rapida"),
]
