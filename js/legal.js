// Páginas legais: Política de Privacidade (LGPD), Trocas e Devoluções (CDC) e Termos de Uso.
// Os textos usam os dados da loja (razão social, CNPJ, e-mail, endereço e regras de reserva)
// que o dono preenche em Painel → Contato e links. Modelo base: vale revisar com um advogado.
const Legal = (() => {
  const { escapar, moeda, duracao } = window.TMZ;
  const S = Dados.estado;
  const tela = document.getElementById("tela-doc");

  const PAGINAS = {
    privacidade: { titulo: "Política de Privacidade", rotulo: "LGPD · Lei 13.709/2018", corpo: privacidade },
    trocas: { titulo: "Trocas e Devoluções", rotulo: "Código de Defesa do Consumidor", corpo: trocas },
    termos: { titulo: "Termos de Uso", rotulo: "Regras da loja", corpo: termos },
  };

  function empresa() {
    const c = S.config;
    const nome = escapar(c.razaoSocial || c.nome || "TMZ STORE");
    const doc = c.cnpj ? `, ${c.cnpj.replace(/\D/g, "").length > 11 ? "CNPJ" : "CPF"} ${escapar(c.cnpj)}` : "";
    return `${nome}${doc}`;
  }
  const contato = () => {
    const c = S.config;
    const canais = [c.email && `pelo e-mail <a href="mailto:${escapar(c.email)}">${escapar(c.email)}</a>`, c.whatsapp && !/^0+$/.test(String(c.whatsapp).replace(/\D/g, "").slice(2)) && `pelo WhatsApp ${escapar(formatarZap(c.whatsapp))}`].filter(Boolean);
    return canais.length ? canais.join(" ou ") : "pelos nossos canais de atendimento";
  };
  function formatarZap(n) {
    const d = String(n).replace(/\D/g, "").replace(/^55/, "");
    return d.length >= 10 ? `(${d.slice(0, 2)}) ${d.slice(2, -4)}-${d.slice(-4)}` : n;
  }
  const atualizado = () => {
    const d = S.config.legalAtualizado ? new Date(S.config.legalAtualizado) : new Date();
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  };

  function privacidade() {
    return `
      <p>Esta política explica quais dados a ${empresa()} ("TMZ", "nós") coleta quando você usa a loja, para que eles servem e quais são os seus direitos, de acordo com a Lei Geral de Proteção de Dados (Lei 13.709/2018).</p>
      <h2>1. Dados que coletamos</h2>
      <ul>
        <li><strong>Na compra ou reserva:</strong> nome, WhatsApp, e-mail (opcional), CEP e endereço de entrega, itens escolhidos e forma de pagamento.</li>
        <li><strong>Na conta:</strong> nome, e-mail, WhatsApp (opcional) e senha. A senha é guardada só de forma criptografada; ninguém da loja tem acesso a ela.</li>
        <li><strong>Na navegação:</strong> o conteúdo do carrinho, contagem de visitas por dia e preferências como o tema claro/escuro. Não usamos cookies de publicidade nem rastreadores de terceiros.</li>
      </ul>
      <h2>2. Para que usamos</h2>
      <ul>
        <li>Registrar, separar, entregar e dar suporte aos seus pedidos e reservas (execução de contrato, art. 7º, V).</li>
        <li>Falar com você sobre o pedido pelo WhatsApp ou e-mail.</li>
        <li>Calcular o frete pelo CEP e preencher o endereço.</li>
        <li>Lembrar o carrinho e entender quantas pessoas visitam a loja, para melhorar o atendimento (legítimo interesse, art. 7º, IX).</li>
        <li>Enviar novidades e cupons só se você pedir, e você pode sair a qualquer momento (consentimento, art. 7º, I).</li>
      </ul>
      <h2>3. Com quem compartilhamos</h2>
      <p>Só com quem precisa para o pedido acontecer: transportadoras e Correios (nome e endereço), o serviço de pagamento quando houver pagamento online, o ViaCEP (apenas o CEP digitado, para achar o endereço) e o provedor que hospeda a loja e o banco de dados. Não vendemos nem alugamos seus dados.</p>
      <h2>4. Por quanto tempo guardamos</h2>
      <p>Os dados de pedidos ficam guardados pelo tempo exigido pela legislação fiscal e de defesa do consumidor (em geral, até 5 anos). Os dados da conta ficam enquanto ela existir; se você pedir a exclusão, apagamos o que não precisamos manter por lei.</p>
      <h2>5. Seus direitos</h2>
      <p>Você pode, a qualquer momento: confirmar se tratamos seus dados, acessar, corrigir, pedir a exclusão ou a portabilidade, saber com quem compartilhamos e retirar o consentimento (art. 18 da LGPD). Para isso, fale com a gente ${contato()}. Respondemos em até 15 dias.</p>
      <h2>6. Segurança</h2>
      <p>Usamos conexão segura (HTTPS), senhas criptografadas e acesso ao painel da loja restrito ao responsável. Se algum incidente puder afetar você, avisaremos e comunicaremos a ANPD, como manda a lei.</p>
      <h2>7. Armazenamento no seu navegador</h2>
      <p>Guardamos no seu próprio navegador apenas o necessário para a loja funcionar: carrinho, CEP, sessão de login, cupom escolhido e tema. Você pode apagar isso limpando os dados do site no navegador.</p>
      <h2>8. Encarregado e contato</h2>
      <p>Responsável pelo tratamento dos dados: ${empresa()}${S.config.endereco ? `, ${escapar(S.config.endereco)}` : ""}. Contato ${contato()}.</p>`;
  }

  function trocas() {
    const c = S.config;
    const prazoTroca = Number(c.prazoTroca) || 30;
    return `
      <p>Queremos que você fique satisfeito com a sua peça. Veja abaixo como funcionam o arrependimento, as trocas e as devoluções na ${empresa()}, de acordo com o Código de Defesa do Consumidor (Lei 8.078/1990).</p>
      <h2>1. Desistência da compra (arrependimento)</h2>
      <p>Comprou pela internet e recebeu em casa? Você pode desistir em até <strong>7 dias corridos depois de receber</strong> o pedido, sem precisar explicar o motivo (art. 49 do CDC). Devolvemos <strong>100% do valor pago, incluindo o frete</strong>, pela mesma forma de pagamento ou por Pix, em até 10 dias úteis depois de recebermos a peça de volta.</p>
      <h2>2. Troca de tamanho ou modelo</h2>
      <p>Você pode trocar por outro tamanho, cor ou modelo em até <strong>${prazoTroca} dias</strong> depois de receber ou retirar. A peça precisa estar sem uso, sem lavagem e com a etiqueta. Na primeira troca de tamanho, o frete de volta é por nossa conta; se o novo item tiver valor diferente, acertamos a diferença.</p>
      <h2>3. Produto com defeito</h2>
      <p>Encontrou defeito? Avise em até <strong>90 dias</strong> (art. 26 do CDC). Analisamos em até 30 dias e você escolhe: troca por outra peça igual, outro produto ou devolução do valor. O frete nesse caso é sempre por nossa conta.</p>
      <h2>4. Reservas com retirada na loja</h2>
      <p>Na reserva você paga um sinal (${escapar(c.reservaPercentual)}% do valor ou ${moeda(Number(c.reservaFixa) || 0)}, conforme a opção escolhida) e a loja separa as peças para você. Se cancelar em até <strong>${duracao(c.estornoJanelaMin)}</strong> depois de reservar, devolvemos o sinal inteiro. Depois desse prazo, devolvemos <strong>${escapar(c.estornoDepoisPerc)}% do sinal</strong>, porque as peças ficaram fora da venda nesse tempo. Essa regra é mostrada e aceita antes de reservar. Ela não se aplica a compras com entrega, que seguem o item 1.</p>
      <h2>5. Como pedir</h2>
      <ol>
        <li>Fale com a gente ${contato()} informando o código do pedido (ex.: TMZ-AB12C).</li>
        <li>Combinamos a coleta, o envio pelos Correios com código de postagem ou a entrega na loja${c.endereco ? ` (${escapar(c.endereco)})` : ""}.</li>
        <li>Recebida a peça, conferimos em até 3 dias úteis e fazemos a troca ou a devolução do valor.</li>
      </ol>
      <h2>6. Não aceitamos troca de</h2>
      <ul>
        <li>Peças usadas, lavadas, sem etiqueta ou danificadas por mau uso (exceto defeito de fabricação).</li>
        <li>Itens de uso íntimo, por questão de higiene, salvo defeito.</li>
      </ul>`;
  }

  function termos() {
    const c = S.config;
    return `
      <p>Ao usar a loja e fazer pedidos na ${empresa()}, você concorda com estes termos. Leia também a <a href="#privacidade">Política de Privacidade</a> e a <a href="#trocas">Política de Trocas e Devoluções</a>.</p>
      <h2>1. Produtos e fotos</h2>
      <p>Trabalhamos com peças peruanas de primeira linha. As fotos são feitas para mostrar a peça da forma mais fiel possível, mas cores podem variar um pouco conforme a tela. Imagens marcadas como ilustração servem só de referência. As marcas citadas pertencem aos seus respectivos donos.</p>
      <h2>2. Preços e estoque</h2>
      <p>Os preços estão em reais e podem mudar sem aviso, mas vale sempre o preço mostrado no momento em que o pedido foi registrado. O estoque é atualizado no site; se uma peça acabar antes da confirmação do pagamento, avisamos e devolvemos o valor pago.</p>
      <h2>3. Pedido e pagamento</h2>
      <p>O pedido é registrado com um código (ex.: TMZ-AB12C) e fica confirmado quando o pagamento é aprovado. Pagamentos por Pix devem ser feitos para a chave mostrada no site em nome de ${escapar(c.pixNome || c.nome)}. Nunca pedimos senha ou código de verificação.</p>
      <h2>4. Entrega e retirada</h2>
      <p>O frete e o prazo são calculados pelo CEP e mostrados antes de finalizar${Number(c.freteGratisAcima) ? `; acima de ${moeda(Number(c.freteGratisAcima))} o frete é grátis` : ""}. O prazo começa a contar depois da confirmação do pagamento. Na retirada na loja, traga o código do pedido e um documento.</p>
      <h2>5. Cupons</h2>
      <p>Cada cupom tem regras próprias (valor mínimo, validade, limite de uso e categorias) mostradas ao aplicar. Cupons não são cumulativos e não valem como dinheiro.</p>
      <h2>6. Conta</h2>
      <p>Você é responsável por manter sua senha em segredo. Podemos suspender contas usadas para fraude.</p>
      <h2>7. Atendimento</h2>
      <p>Fale com a gente ${contato()}${c.horario ? ` (${escapar(c.horario)})` : ""}.</p>
      <h2>8. Foro</h2>
      <p>Fica eleito o foro do domicílio do consumidor para resolver qualquer questão relacionada a estes termos.</p>`;
  }

  function render(qual) {
    const pag = PAGINAS[qual];
    if (!pag) return;
    tela.querySelector("#doc-rotulo").textContent = pag.rotulo;
    tela.querySelector("#doc-titulo").textContent = pag.titulo;
    tela.querySelector("#doc-conteudo").innerHTML = `${pag.corpo()}<p class="doc__data">Atualizado em ${atualizado()}.</p>`;
    tela.querySelector("#doc-nav").innerHTML = Object.entries(PAGINAS)
      .map(([id, p]) => `<a href="#${id}" class="filtro${id === qual ? " ativo" : ""}">${p.titulo}</a>`).join("");
  }

  let aberta = "";
  window.addEventListener("tmz:rota", (e) => {
    aberta = e.detail in PAGINAS ? e.detail : "";
    if (aberta) render(aberta);
  });
  if (location.hash.slice(1) in PAGINAS) { aberta = location.hash.slice(1); render(aberta); }
  Dados.ouvir(() => { if (aberta) render(aberta); });

  // Aviso de armazenamento (uma vez por navegador)
  const aviso = document.getElementById("aviso-cookies");
  let visto = false;
  try { visto = localStorage.getItem("tmz-aviso-dados") === "1"; } catch { visto = true; }
  if (!visto) setTimeout(() => { aviso.hidden = false; }, 1200);
  aviso.querySelector("button").addEventListener("click", () => {
    aviso.hidden = true;
    try { localStorage.setItem("tmz-aviso-dados", "1"); } catch {}
  });

  return { PAGINAS };
})();
