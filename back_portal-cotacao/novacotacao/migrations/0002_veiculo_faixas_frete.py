from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("novacotacao", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="veiculo",
            name="frete_minimo_ate_50km",
            field=models.DecimalField(
                decimal_places=2,
                default=0,
                max_digits=14,
                verbose_name="Frete mínimo até 50 km (R$)",
            ),
        ),
        migrations.AddField(
            model_name="veiculo",
            name="tarifa_0_50",
            field=models.DecimalField(
                decimal_places=2, default=0, max_digits=14, verbose_name="0–50 km (R$)"
            ),
        ),
        migrations.AddField(
            model_name="veiculo",
            name="tarifa_51_100",
            field=models.DecimalField(
                decimal_places=2, default=0, max_digits=14, verbose_name="51–100 km (R$)"
            ),
        ),
        migrations.AddField(
            model_name="veiculo",
            name="tarifa_101_150",
            field=models.DecimalField(
                decimal_places=2, default=0, max_digits=14, verbose_name="101–150 km (R$)"
            ),
        ),
        migrations.AddField(
            model_name="veiculo",
            name="tarifa_151_200",
            field=models.DecimalField(
                decimal_places=2, default=0, max_digits=14, verbose_name="151–200 km (R$)"
            ),
        ),
        migrations.AddField(
            model_name="veiculo",
            name="tarifa_201_300",
            field=models.DecimalField(
                decimal_places=2, default=0, max_digits=14, verbose_name="201–300 km (R$)"
            ),
        ),
        migrations.AddField(
            model_name="veiculo",
            name="tarifa_301_400",
            field=models.DecimalField(
                decimal_places=2, default=0, max_digits=14, verbose_name="301–400 km (R$)"
            ),
        ),
        migrations.AddField(
            model_name="veiculo",
            name="tarifa_401_500",
            field=models.DecimalField(
                decimal_places=2, default=0, max_digits=14, verbose_name="401–500 km (R$)"
            ),
        ),
        migrations.AddField(
            model_name="veiculo",
            name="tarifa_acima_500",
            field=models.DecimalField(
                decimal_places=2, default=0, max_digits=14, verbose_name="Acima de 500 km (R$)"
            ),
        ),
    ]
