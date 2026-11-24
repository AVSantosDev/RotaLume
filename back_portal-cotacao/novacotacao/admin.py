from django.contrib import admin
from .models import Cliente, Veiculo, Solicitante, Semireboque # Adicione seus outros modelos aqui

admin.site.register(Cliente)
admin.site.register(Veiculo)
admin.site.register(Solicitante)
admin.site.register(Semireboque)