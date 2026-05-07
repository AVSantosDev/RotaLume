from django.db import migrations, models
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ("novacotacao", "0003_cotacao_snapshot"),
    ]

    operations = [
        migrations.AddField(
            model_name="cotacao",
            name="public_id",
            field=models.UUIDField(default=uuid.uuid4, editable=False, unique=True),
        ),
        migrations.AddField(
            model_name="cotacao",
            name="status",
            field=models.CharField(
                choices=[
                    ("AGUARDANDO_APROVACAO", "AGUARDANDO APROVAÇÃO"),
                    ("APROVADA", "APROVADA"),
                    ("NAO_APROVADA", "NÃO APROVADA"),
                ],
                default="AGUARDANDO_APROVACAO",
                max_length=30,
            ),
        ),
        migrations.AddField(
            model_name="cotacao",
            name="motivo_nao_aprovacao",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.AddField(
            model_name="cotacao",
            name="pdf_path",
            field=models.CharField(blank=True, default="", max_length=500),
        ),
        migrations.AddField(
            model_name="cotacao",
            name="ctrb_orcado",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=14),
        ),
        migrations.AddField(
            model_name="cotacao",
            name="frete_all_in_sicms",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=14),
        ),
        migrations.AddField(
            model_name="cotacao",
            name="frete_all_in_cicms",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=14),
        ),
        migrations.AddField(
            model_name="cotacao",
            name="frete_all_in_desc",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=14),
        ),
        migrations.AddField(
            model_name="cotacao",
            name="lair_pct",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=7),
        ),
        migrations.AddField(
            model_name="cotacao",
            name="lair_valor",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=14),
        ),
    ]

