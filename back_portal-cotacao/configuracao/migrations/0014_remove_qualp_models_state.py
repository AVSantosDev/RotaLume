from django.db import migrations


class Migration(migrations.Migration):
    """
    Remove modelos QualP apenas do estado do app configuracao (tabelas permanecem;
    ownership passa para configsistema).
    """

    dependencies = [
        ("configuracao", "0013_qualp_cache_validade"),
        ("configsistema", "0001_initial"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[],
            state_operations=[
                migrations.DeleteModel(name="QualpCacheRota"),
                migrations.DeleteModel(name="QualpConsultaHistorico"),
                migrations.DeleteModel(name="QualpConfiguracao"),
            ],
        ),
    ]
