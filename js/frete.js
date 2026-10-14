// Frete pelo CEP. Busca o endereço no ViaCEP (grátis, sem chave) e calcula o frete pela distância
// da loja: mesma cidade, mesmo estado, mesma região ou resto do Brasil. Sem internet, descobre o
// estado pela faixa do CEP. Os valores e prazos ficam em Painel → Configurações → Frete.
const Frete = (() => {
  // Faixas de CEP por estado (cinco primeiros dígitos)
  const FAIXAS = [
    [1000, 19999, "SP"], [20000, 28999, "RJ"], [29000, 29999, "ES"], [30000, 39999, "MG"],
    [40000, 48999, "BA"], [49000, 49999, "SE"], [50000, 56999, "PE"], [57000, 57999, "AL"],
    [58000, 58999, "PB"], [59000, 59999, "RN"], [60000, 63999, "CE"], [64000, 64999, "PI"],
    [65000, 65999, "MA"], [66000, 68899, "PA"], [68900, 68999, "AP"], [69000, 69299, "AM"],
    [69300, 69399, "RR"], [69400, 69899, "AM"], [69900, 69999, "AC"], [70000, 72799, "DF"],
    [72800, 72999, "GO"], [73000, 73699, "DF"], [73700, 76799, "GO"], [76800, 76999, "RO"],
    [77000, 77999, "TO"], [78000, 78899, "MT"], [79000, 79999, "MS"], [80000, 87999, "PR"],
    [88000, 89999, "SC"], [90000, 99999, "RS"],
  ];
  const REGIOES = {
    Norte: ["AC", "AP", "AM", "PA", "RO", "RR", "TO"],
    Nordeste: ["AL", "BA", "CE", "MA", "PB", "PE", "PI", "RN", "SE"],
    "Centro-Oeste": ["DF", "GO", "MT", "MS"],
    Sudeste: ["ES", "MG", "RJ", "SP"],
    Sul: ["PR", "RS", "SC"],
  };
  const NOMES_FAIXA = { cidade: "Mesma cidade", estado: "Mesmo estado", regiao: "Mesma região", brasil: "Outras regiões" };
  const TABELA_PADRAO = {
    cidade: { valor: 12, prazo: 2 }, estado: { valor: 19.9, prazo: 4 },
    regiao: { valor: 24.9, prazo: 6 }, brasil: { valor: 34.9, prazo: 9 },
  };

  const digitos = (v) => String(v || "").replace(/\D/g, "");
  const semAcento = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

  function ufDoCep(cep) {
    const n = Number(digitos(cep).slice(0, 5));
    return FAIXAS.find(([de, ate]) => n >= de && n <= ate)?.[2] || "";
  }
  const regiaoDe = (uf) => Object.entries(REGIOES).find(([, ufs]) => ufs.includes(uf))?.[0] || "";

  const cache = new Map();
  // { cep, uf, cidade, logradouro, bairro, confirmado } — confirmado = veio do ViaCEP
  async function buscarCep(cep) {
    cep = digitos(cep);
    if (cep.length !== 8) return null;
    if (cache.has(cep)) return cache.get(cep);
    let destino = { cep, uf: ufDoCep(cep), cidade: "", logradouro: "", bairro: "", confirmado: false };
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 5000);
      const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`, { signal: ctrl.signal });
      clearTimeout(t);
      const d = await r.json();
      if (d.erro) destino = { ...destino, invalido: true };
      else destino = { cep, uf: d.uf, cidade: d.localidade, logradouro: d.logradouro, bairro: d.bairro, confirmado: true };
    } catch {}
    if (!destino.uf) destino.invalido = true;
    cache.set(cep, destino);
    return destino;
  }

  // config: { freteModo, frete, lojaUF, lojaCidade, freteTabela }
  function calcular(destino, config) {
    if (config.freteModo !== "regiao") return { valor: Number(config.frete) || 0, prazo: null, faixa: "fixo" };
    if (!destino || destino.invalido) return null;
    const tabela = { ...TABELA_PADRAO, ...(config.freteTabela || {}) };
    let faixa = "brasil";
    if (destino.uf === config.lojaUF) {
      faixa = destino.cidade && semAcento(destino.cidade) === semAcento(config.lojaCidade) ? "cidade" : "estado";
    } else if (regiaoDe(destino.uf) && regiaoDe(destino.uf) === regiaoDe(config.lojaUF)) {
      faixa = "regiao";
    }
    return { valor: Number(tabela[faixa].valor) || 0, prazo: Number(tabela[faixa].prazo) || null, faixa };
  }

  const UFS = FAIXAS.map((f) => f[2]).filter((uf, i, a) => a.indexOf(uf) === i).sort();

  return { buscarCep, calcular, ufDoCep, regiaoDe, UFS, NOMES_FAIXA, TABELA_PADRAO };
})();
