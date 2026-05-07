function brDateTime(dt = new Date()) {
  try {
    return dt.toLocaleString('pt-BR');
  } catch {
    return String(dt);
  }
}

function brDate(dt = new Date()) {
  try {
    return dt.toLocaleDateString('pt-BR');
  } catch {
    return String(dt);
  }
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

const fmtBRL = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return 'R$ 0,00';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const upper = (s) => String(s || '').toUpperCase();

export function buildPropostaHtml(data) {
  const tpl = data?.template || {};
  const empresaNome = String(tpl.empresa_nome || 'ESTRELA DO ORIENTE');
  const logoDataUrl = String(tpl.logo_data_url || '');
  const titulo = String(tpl.titulo || 'PROPOSTA COMERCIAL');
  const emailComercial = String(tpl.email_comercial || 'comercial@estrelaoriente.com.br');
  const telComercial = String(tpl.telefone_comercial || 'fone/whatsapp: 41 9973-1834');
  const condicoesTxt = String(tpl.condicoes_comerciais || '');
  const condicoesLines = condicoesTxt
    ? condicoesTxt.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    : [
        '* Pedágio incluso no frete',
        '* ICMS/ISS não incluso no frete, cobrado conforme legislação vigente',
        '* Seguro não incluso no frete - 0,10% sobre o valor da mercadoria',
        '* GRIS não incluso no frete - 0,08% sobre o valor da mercadoria',
        '* Carga/Descarga não incluso no frete',
        '* Custo adicional por Ajudante de R$ 360 acrescido dos impostos conforme legislação vigente',
        '* Taxa adicional a partir da 2ª Entrega de R$ 590 acrescido dos impostos conforme legislação vigente',
        '* Prazo de Pagamento: 15 dias a partir da emissão do documento fiscal',
        '* Cobrança bancária',
        '* Devolução da Mercadoria: Será cobrado 100% do Frete Original',
        '* Reentrega da Mercadoria: Será cobrado 70% do Frete Original',
        '* Transit time: Será sendo realizado de acordo com a Lei nº 13103/2015, que determina o tempo de duração da jornada do motorista.',
        '* Tempo de carga: 4 horas',
        '* Tempo de descarga: 4 horas',
        '* Acima será cobrado diária de R$ 900,00 para 3/4 toco e R$ 1.200,00 para carretas a cada 24 horas + impostos',
      ];

  const numero = data?.numeroCotacao ? String(data.numeroCotacao) : '';
  const cliente = upper(data?.cliente_nome || data?.cliente || '');
  const cnpj = String(data?.cliente_cnpj || '');
  const contato = String(data?.contato || data?.solicitante_nome || '');
  const email = String(data?.email || data?.solicitante_email || '');
  const origem = `${data?.origem || ''}${data?.uf_origem ? `-${data.uf_origem}` : ''}`.trim();
  const destino = `${data?.destino || ''}${data?.uf_destino ? `-${data.uf_destino}` : ''}`.trim();
  const veiculo = upper(data?.tipoVeiculo || data?.tipo_veiculo || '');
  const qtdAjud = data?.qtdAjudante ?? data?.qtd_ajudante ?? 0;
  const qtdEntAdic = data?.taxaAdicionalEntrega ? 1 : 0;

  const fretePeso = fmtBRL(data?.sIcms?.fretePeso ?? data?.frete_peso_sicms ?? 0);
  const seguro = fmtBRL(data?.sIcms?.seguro ?? data?.seguro_sicms ?? 0);
  const gris = fmtBRL(data?.sIcms?.gris ?? data?.gris_sicms ?? 0);
  const pedagio = fmtBRL(data?.sIcms?.pedagio ?? data?.pedagio_sicms ?? data?.pedagio_utilizado ?? 0);
  const descarga = fmtBRL(0);
  const adicionalEntrega = fmtBRL(data?.taxaAdicionalEntrega ?? data?.taxa_adicional_entrega ?? 0);
  const freteLiquido = fmtBRL(data?.frete_all_in_sicms ?? data?.sIcms?.total ?? 0);
  const icms = fmtBRL((data?.frete_all_in_cicms ?? data?.cIcms?.total ?? 0) - (data?.frete_all_in_sicms ?? data?.sIcms?.total ?? 0));
  const freteBruto = fmtBRL(data?.frete_all_in_cicms ?? data?.cIcms?.total ?? 0);

  const hoje = new Date();
  const validade = addDays(hoje, 15);

  return `
  <div style="padding:16px 18px 10px 18px;">
    <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px;">
      <div style="min-width:220px;">
        ${
          logoDataUrl
            ? `<img src="${logoDataUrl.replace(/"/g, '&quot;')}" alt="Logo" style="height:44px; max-width:240px; object-fit:contain; display:block;" />`
            : `<div style="font-size:14px; font-weight:800; color:#0b1f44;">${empresaNome}</div>`
        }
        <div style="font-size:10px; color:#64748b; margin-top:2px;">Proposta gerada em ${brDateTime(hoje)}</div>
      </div>
      <div style="flex:1; text-align:center; font-size:22px; font-weight:900; letter-spacing:0.5px;">
        ${titulo}
      </div>
      <div style="display:flex; align-items:stretch; gap:0;">
        <div style="background:#0f172a; color:#fff; padding:10px 12px; font-size:12px; font-weight:900; display:flex; align-items:center;">
          Nr.:
        </div>
        <div style="border:2px solid #0f172a; border-left:0; padding:6px 14px; font-size:26px; font-weight:900; min-width:110px; text-align:center;">
          ${numero || '—'}
        </div>
      </div>
    </div>

    <div style="margin-top:14px; border:1px solid #cbd5e1;">
      <div style="display:grid; grid-template-columns: 120px 1fr 120px 1fr 120px 1fr; border-bottom:1px solid #cbd5e1;">
        <div style="background:#0f172a; color:#fff; padding:8px 10px; font-size:12px; font-weight:800;">Cliente:</div>
        <div style="padding:8px 10px; font-size:12px; font-weight:700;">${cliente || '—'}</div>
        <div style="background:#0f172a; color:#fff; padding:8px 10px; font-size:12px; font-weight:800;">Data:</div>
        <div style="padding:8px 10px; font-size:12px; font-weight:700;">${brDate(hoje)}</div>
        <div style="background:#0f172a; color:#fff; padding:8px 10px; font-size:12px; font-weight:800;">Validade:</div>
        <div style="padding:8px 10px; font-size:12px; font-weight:700;">${brDate(validade)}</div>
      </div>
      <div style="display:grid; grid-template-columns: 120px 1fr 120px 1fr 120px 1fr;">
        <div style="background:#0f172a; color:#fff; padding:8px 10px; font-size:12px; font-weight:800;">Contato:</div>
        <div style="padding:8px 10px; font-size:12px; font-weight:700;">${contato || '—'}</div>
        <div style="background:#0f172a; color:#fff; padding:8px 10px; font-size:12px; font-weight:800;">email:</div>
        <div style="padding:8px 10px; font-size:12px; font-weight:700;">${email || '—'}</div>
        <div style="background:#0f172a; color:#fff; padding:8px 10px; font-size:12px; font-weight:800;">CNPJ:</div>
        <div style="padding:8px 10px; font-size:12px; font-weight:700;">${cnpj || '—'}</div>
      </div>
    </div>

    <div style="margin-top:10px; border:1px solid #cbd5e1;">
      <div style="display:grid; grid-template-columns: 1fr 1fr 1fr 2fr 0.7fr 0.9fr; background:#334155; color:#fff;">
        <div style="padding:6px 8px; font-size:11px; font-weight:900; text-align:center;">Origem</div>
        <div style="padding:6px 8px; font-size:11px; font-weight:900; text-align:center;">Destino</div>
        <div style="padding:6px 8px; font-size:11px; font-weight:900; text-align:center;">Valor Produto</div>
        <div style="padding:6px 8px; font-size:11px; font-weight:900; text-align:center;">Veículo</div>
        <div style="padding:6px 8px; font-size:11px; font-weight:900; text-align:center;">Qt.Ajud.</div>
        <div style="padding:6px 8px; font-size:11px; font-weight:900; text-align:center;">Qt.Ent.Adic.</div>
      </div>
      <div style="display:grid; grid-template-columns: 1fr 1fr 1fr 2fr 0.7fr 0.9fr;">
        <div style="padding:8px 10px; font-size:12px; font-weight:800;">${origem || '—'}</div>
        <div style="padding:8px 10px; font-size:12px; font-weight:800;">${destino || '—'}</div>
        <div style="padding:8px 10px; font-size:12px; font-weight:800;">${fmtBRL(data?.valorMercadoria ?? data?.valor_mercadoria ?? 0)}</div>
        <div style="padding:8px 10px; font-size:12px; font-weight:900; text-align:center;">${veiculo || '—'}</div>
        <div style="padding:8px 10px; font-size:12px; font-weight:900; text-align:center;">${qtdAjud}</div>
        <div style="padding:8px 10px; font-size:12px; font-weight:900; text-align:center;">${qtdEntAdic}</div>
      </div>

      <table style="width:100%; border-collapse:collapse; table-layout:fixed; border-top:1px solid #cbd5e1;">
        <colgroup>
          <col style="width:11.11%" />
          <col style="width:11.11%" />
          <col style="width:11.11%" />
          <col style="width:11.11%" />
          <col style="width:11.11%" />
          <col style="width:11.11%" />
          <col style="width:11.11%" />
          <col style="width:11.11%" />
          <col style="width:11.11%" />
        </colgroup>
        <thead>
          <tr style="background:#334155; color:#fff;">
            <th style="padding:6px 6px; font-size:11px; font-weight:900; text-align:center; border-right:1px solid #475569;">FRETE PESO</th>
            <th style="padding:6px 6px; font-size:11px; font-weight:900; text-align:center; border-right:1px solid #475569;">SEGURO</th>
            <th style="padding:6px 6px; font-size:11px; font-weight:900; text-align:center; border-right:1px solid #475569;">GRIS</th>
            <th style="padding:6px 6px; font-size:11px; font-weight:900; text-align:center; border-right:1px solid #475569;">PEDÁGIO</th>
            <th style="padding:6px 6px; font-size:11px; font-weight:900; text-align:center; border-right:1px solid #475569;">DESCARGA</th>
            <th style="padding:6px 6px; font-size:11px; font-weight:900; text-align:center; border-right:1px solid #475569;">ADICIONAL ENTREGA</th>
            <th style="padding:6px 6px; font-size:11px; font-weight:900; text-align:center; border-right:1px solid #475569;">FRETE LIQ.</th>
            <th style="padding:6px 6px; font-size:11px; font-weight:900; text-align:center; border-right:1px solid #475569;">ICMS</th>
            <th style="padding:6px 6px; font-size:11px; font-weight:900; text-align:center;">FRETE BRUTO</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="padding:8px 6px; font-size:12px; font-weight:900; text-align:center; border-right:1px solid #e2e8f0;">${fretePeso}</td>
            <td style="padding:8px 6px; font-size:12px; font-weight:900; text-align:center; border-right:1px solid #e2e8f0;">${seguro}</td>
            <td style="padding:8px 6px; font-size:12px; font-weight:900; text-align:center; border-right:1px solid #e2e8f0;">${gris}</td>
            <td style="padding:8px 6px; font-size:12px; font-weight:900; text-align:center; border-right:1px solid #e2e8f0;">${pedagio}</td>
            <td style="padding:8px 6px; font-size:12px; font-weight:900; text-align:center; border-right:1px solid #e2e8f0;">${descarga}</td>
            <td style="padding:8px 6px; font-size:12px; font-weight:900; text-align:center; border-right:1px solid #e2e8f0;">${adicionalEntrega}</td>
            <td style="padding:8px 6px; font-size:12px; font-weight:900; text-align:center; background:#fff7ed; border-right:1px solid #e2e8f0;">${freteLiquido}</td>
            <td style="padding:8px 6px; font-size:12px; font-weight:900; text-align:center; background:#fff7ed; border-right:1px solid #e2e8f0;">${icms}</td>
            <td style="padding:8px 6px; font-size:12px; font-weight:900; text-align:center; background:#fff7ed;">${freteBruto}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div style="margin-top:12px; background:#334155; color:#fff; padding:8px 10px; font-size:18px; font-weight:900; text-align:center;">
      CONDIÇÕES COMERCIAIS
    </div>
    <div style="border:1px solid #cbd5e1; border-top:0; padding:10px 12px; font-size:12px; line-height:1.5;">
      ${condicoesLines.map((l) => `<div>${l.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>`).join('')}
    </div>

    <div style="margin-top:14px; font-size:12px;">
      <div style="margin-top:14px;">Estamos à disposição para esclarecer eventuais dúvidas.</div>
      <div style="margin-top:18px; text-align:center;">Atenciosamente,</div>
      <div style="margin-top:10px; text-align:center; color:#2563eb; font-weight:700;">${emailComercial}</div>
      <div style="margin-top:2px; text-align:center; color:#64748b; font-weight:700;">${telComercial}</div>
    </div>
  </div>
  `;
}

