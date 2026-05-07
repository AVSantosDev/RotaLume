from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("configsistema", "0002_propostatemplate"),
    ]

    operations = [
        migrations.AddField(
            model_name="propostatemplate",
            name="logo_data_url",
            field=models.TextField(blank=True, default=""),
        ),
    ]

