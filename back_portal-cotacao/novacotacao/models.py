from django.db import models

# Create your models here.
class Cliente(models.Model):
    id = models.BigAutoField(primary_key=True)
    nome_empresa = models.CharField(max_length=255)
    cnpj = models.CharField(max_length=14)
    endereco = models.CharField(max_length=255)
    cep = models.CharField(max_length=8)
    numero = models.IntegerField( null= True, blank=True)
   
    def __str__(self):
        return self.nome_empresa


class Solicitante(models.Model):
    id= models.BigAutoField(primary_key=True)
    cliente = models.ForeignKey(Cliente, on_delete=models.CASCADE, related_name='solicitantes')
    nome = models.CharField(max_length=255)
    email = models.EmailField()
    telefone = models.CharField()

    def __str__(self):
        return f"{self.nome} ({self.cliente.nome_empresa})"



class Veiculo(models.Model):
    id = models.BigAutoField(primary_key=True)
    tipo_veiculo = models.CharField(max_length=255, verbose_name="Tipo de veiculo")
    eixos_veiculo = models.IntegerField()

    def __str__(self):
        return f"{self.tipo_veiculo} ({self.eixos_veiculo})"




class Semireboque(models.Model):
    id = models.BigAutoField(primary_key=True)
    tipo_semireboque = models.CharField(max_length=255)
    eixos_semireboque = models.IntegerField()

    def __str__(self):
        return f"{self.tipo_semireboque} ({self.cliente.eixos_semireboque})"