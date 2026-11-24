from django.db import migrations


SQL_CREATE = """
CREATE TABLE IF NOT EXISTS tabela_icms (
  id SERIAL PRIMARY KEY,
  origem VARCHAR(2) NOT NULL,
  destino VARCHAR(2) NOT NULL,
  aliquota NUMERIC(5,2) NOT NULL
);

-- Evita duplicidade e acelera consultas
CREATE UNIQUE INDEX IF NOT EXISTS uq_tabela_icms_origem_destino ON tabela_icms (origem, destino);
"""


class Migration(migrations.Migration):

    dependencies = [
        ("configuracao", "0021_clientetaxasconfig_malha_spot_tipo"),
    ]

    operations = [
        migrations.RunSQL(SQL_CREATE, reverse_sql=migrations.RunSQL.noop),
    ]

