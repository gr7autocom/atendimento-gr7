# Changelog — GR7 Atendimento

> Histórico de marcos entregues. Estado atual em `PROGRESSO.md`.

---

## 2026-08-10 — Editar e apagar avisam antes de recusar

- No app do cliente, tentar editar ou apagar uma mensagem antiga agora mostra de cara que o prazo passou, em vez de deixar escolher a nota, escrever o texto novo ou confirmar o apagar para só então recusar

## 2026-08-09 — A nota de avaliação virou pop-up

- Quando o atendente encerra o chamado, o cliente agora vê um pop-up perguntando a nota de 0 a 10, em vez da pergunta discreta que ficava escondida embaixo da conversa

## 2026-08-09 — Direito de exclusão da LGPD

- O administrador pode apagar os dados de quem pede exclusão: nome, telefone, as mensagens e os arquivos enviados saem, no sistema e no serviço de armazenamento
- O chamado continua registrado, sem identificar a pessoa. É a prova de que o atendimento aconteceu, e a lei manda guardar por cinco anos
- Para evitar clique errado, a exclusão só libera depois de digitar o telefone de quem vai ser esquecido
- O aviso de privacidade passou a dizer os dois serviços contratados pelo nome (Supabase e Cloudinary), em vez de "serviços contratados"
- Criado o inventário de privacidade do produto (`docs/lgpd/`): o que é coletado, para quê, e como atender cada pedido

## 2026-08-08 — Anexo, áudio e as ações do chat

- Atendente e cliente podem enviar arquivos: print, foto, PDF, planilha e documento. Imagem aparece aberta na conversa e abre em tamanho maior ao clicar; o resto vira uma linha com o nome e o tamanho
- Dá para gravar áudio pelo microfone, escutar antes de enviar e descartar se não ficou bom
- Botão direito (ou toque longo, no celular) abre as ações da mensagem: responder citando e apagar
- **Mensagem apagada some para o cliente**, e continua visível para a equipe com o texto, marcada com quem apagou e a que horas. É o que permite conferir depois o que foi enviado
- O cliente pode apagar o que mandou por 1 hora e editar por 15 minutos, como no WhatsApp. A equipe vê a marca de editada e o texto anterior
- Chegou mensagem, toca um som. Com a janela em segundo plano, aparece também o aviso do Windows. O sino no topo liga ou desliga esses avisos, e antes ele não fazia nada
- Agora são dois sons, com papéis diferentes: um mais forte avisa que chegou mensagem em outro chamado, e um curto confirma o que sai e o que chega na conversa que está aberta na tela
- Responder um cliente passou a ter som de confirmação, nos dois lados. Ele toca depois que a mensagem é gravada de verdade, então som ouvido é mensagem entregue
- O aviso de privacidade passou a explicar que arquivos e áudios também ficam guardados, e pede para enviar só o necessário

## 2026-08-07 — O cliente sabe o que acontece com os dados dele

- Ao lado do aceite, um link "Como usamos seus dados" abre em janela e explica o que é pedido, para que serve, quem vê e por quanto tempo fica guardado. Antes a pessoa marcava a caixa sem ter onde ler o que estava aceitando
- Quem quiser corrigir ou apagar os dados tem para onde escrever, e a resposta diz o que pode ser apagado e o que a lei obriga a manter
- As sessões do canal web que já venceram passaram a ser apagadas sozinhas, uma vez por dia. Elas guardam telefone e vínculo com o chamado, e sessão morta não é usada por nada

## 2026-08-07 — O cliente pode instalar o Atendimento como aplicativo

- O site do cliente virou aplicativo instalável: abre em janela própria, com ícone na área de trabalho e na tela inicial do celular, sem barra de endereço
- Aberto sem internet, o app carrega e explica que não conseguiu falar com o servidor, em vez de mostrar a página de erro do navegador. A conversa em si nunca fica guardada no aparelho
- A central da equipe continua sendo só site, e o navegador não oferece instalação dela
- A marca passou a aparecer com a logo da GR7 em todas as telas: topo da central, login, entrada do cliente e menu do celular
- A tela de login dizia "Central de WhatsApp da equipe" e agora diz "Central de atendimento da equipe", porque o chamado também chega pelo site
- A publicação passou a gerar duas pastas prontas, uma para cada endereço: `dist/atendimento/` para a equipe e `dist/suporte/` para o cliente. Sobe cada uma no seu subdomínio e acabou

## 2026-08-07 — A central mostra de onde veio cada chamado

- O atendente distingue chamado do WhatsApp e do site pelo ícone no avatar e pelo rótulo no cabeçalho, e pode filtrar a fila por canal quando os dois estiverem em uso
- Em chamado do site, o cabeçalho diz se o cliente está na conversa, ausente ou sem acesso. Serve para saber se a resposta vai ser lida agora ou se a pessoa está com a tela fechada
- O painel do contato avisa que nome e telefone do site foram digitados pelo cliente e não foram verificados. No WhatsApp o número é garantido pelo provedor, no site não
- O menu da conversa ganhou "Encerrar acesso do cliente", para quando quem abriu o chamado não deve mais entrar, por exemplo se saiu da empresa
- O aviso de reabertura no chamado finalizado passou a dizer a verdade em cada caso. Antes prometia reabrir em 3 horas sempre, mesmo quando a próxima mensagem abriria um chamado novo, e ignorava o prazo configurado

## 2026-08-04 — Histórico do contato e aviso quando algo não salva

- No painel do contato, a seção Histórico mostra os atendimentos anteriores da mesma pessoa, com protocolo, data, setor, quem atendeu e como terminou. Serve para saber o que já foi tratado antes de responder
- Os contadores de atendimentos e mensagens do contato passaram a mostrar o total real. Antes o atendente via um número menor, porque contava só os chamados dele
- Quando uma alteração não pode ser salva, a tela agora explica o motivo. Antes o campo voltava ao valor anterior sem dizer nada, e parecia que o botão Salvar estava quebrado

---

## 2026-07-30 — Padronização visual e acessibilidade

- A fonte do sistema agora é Roboto. Protocolo, telefone e hora usam Roboto Mono, que alinha os números em coluna
- Texto de apoio, telefone na lista e hora das mensagens ficaram mais legíveis: a cor anterior não atingia o mínimo de contraste
- A borda dos campos aparece de verdade. Antes era quase invisível e ficava difícil ver onde clicar
- O botão principal não clareia mais ao passar o mouse, o que deixava o texto branco ilegível justo na hora do clique
- Remover departamento, tag ou mensagem rápida agora abre uma confirmação do próprio sistema, dizendo o que sai e o que muda. Antes era a caixa cinza do navegador
- Enviar, assumir, transferir, finalizar, salvar e adicionar horário travam enquanto a ação está em curso, então clique duplo não executa duas vezes
- As buscas de chamado, de tag e de contato ganharam botão para limpar
- No painel de supervisão, as três métricas sem fonte de dados (atendentes online, novas mensagens, retornos) dizem "Sem dados até conectar o WhatsApp" em vez de mostrar zero como se a operação tivesse parado
- Quem usa teclado navega as abas das telas de configuração com as setas, e o foco fica preso dentro das janelas até fechar
- Quem pede menos animação no sistema operacional recebe a interface sem movimento

---

## 2026-07-29 — Tarefa aberta pelo chat: regras mais firmes

- A tarefa só é aberta para contato com empresa vinculada. Sem vínculo, a seção Tarefas explica o que fazer em vez de deixar criar solta
- Início previsto e prazo de entrega já vêm preenchidos com agora e hoje às 18:00, editáveis. Tarefa sem prazo não aparece como atrasada no painel nem entra no aviso diário de prazo
- Toda tarefa aberta pelo chat chega ao painel com categoria Outros e classificação Solicitações de cliente, então não some mais dos filtros de lá
- A criação virou uma operação só no banco: ou a tarefa é criada e vinculada ao atendimento, ou nada é gravado. Antes, uma falha no meio podia deixar tarefa duplicada no painel
- Quando o perfil não tem permissão para criar tarefa, a mensagem diz isso, no lugar do erro genérico

---

## 2026-07-28 — Tarefas no atendimento

- No painel do contato, o atendente agora abre uma tarefa direto do chat, na seção Tarefas: informa o título e, se quiser, descrição, responsável, prioridade, início previsto e prazo de entrega
- A tarefa vai para o painel de implantação, onde a equipe dá andamento; o atendimento só abre e acompanha
- A tarefa já nasce vinculada à empresa do contato (quando há empresa cadastrada) e atribuída a quem abriu, dá para deixar em aberto ou escolher outro responsável
- A seção lista as tarefas abertas por aquele contato, mostrando as 3 mais recentes com status e prioridade; havendo mais, um "Ver mais" leva ao painel
- Tarefas criadas direto no painel não aparecem aqui: a lista mostra só o que foi aberto pelo atendimento

---

## 2026-07-27 — Bot de atendimento, histórico e configurações

- O bot conduz o atendimento pelo WhatsApp: dá boas-vindas, mostra o menu de setores, coloca na fila e encerra com #sair (ainda em teste interno, sem número conectado)
- Cliente sem cadastro é convidado a se identificar antes do menu; se manda o CNPJ, o sistema já vincula a empresa sozinho
- Ao finalizar, o bot pede uma nota de 0 a 10 e registra a avaliação do atendimento
- A conversa mostra mensagens de sistema (abertura, fim do bot, quem assumiu ou saiu, encerramento) para o time acompanhar o histórico; o cliente não as vê
- Transferir agora permite soltar o chamado de volta para a fila sem escolher ninguém, para qualquer atendente assumir
- A tela de Configurações do bot foi reorganizada em abas (Geral, Atendimento, Potenciais), em largura total, com nome do bot e mais ajustes
- O painel de informações do contato foi reorganizado: protocolo em destaque, contadores de atendimentos e mensagens, e seções que abrem e fecham (a primeira, Informações)
- Um atendimento pode ter mais de um atendente: o responsável (ou um admin) inclui colegas para acompanhar e responder o mesmo chamado; quem é incluído vê a conversa na aba Ativos com o selo "Participo"
- Fora do horário comercial, o bot avisa que está fora de expediente e não abre chamado; havendo plantão, o atendimento segue normalmente
- Se o cliente volta em até 3 horas após um atendimento que não chegou a ser avaliado, o bot retoma o mesmo protocolo em vez de abrir outro
- As telas de Departamento e Atendente passaram a usar abas (como a de Configurações do bot), e o card de atendente ficou mais compacto, no mesmo formato do card de departamento

---

## 2026-07-25 — Tags no atendimento e telas de admin

- Departamentos e Tags reformulados: Departamentos em cards, e Tags com cor própria e escopo por departamento
- O atendente agora aplica uma ou mais tags ao chamado direto no chat; as tags aparecem no card da conversa
- O card da conversa passou a mostrar a empresa do contato quando há vínculo
- Tela de Atendentes em cards com foto (a mesma do painel) e filtros por nome, departamento e status
- Plantão agora é definido por atendente (Horários de Acesso no card), não mais numa lista única
- Acesso ao Atendimento fora do horário comercial só para quem está de plantão; administradores sempre entram
- Mensagens rápidas reformuladas (por departamento) e acionáveis no chat com `/`, com variáveis do nome do atendente e do contato
- Motivos de finalização agora são definidos por departamento, dentro do próprio departamento
- Cada departamento pode ter um horário de atendimento próprio e mostra se está disponível ou fora de horário
- Configurar um departamento agora abre uma tela própria (dados, horário e motivos), com mais espaço
- Configurar um atendente também abre uma tela própria (departamentos e horários de acesso)
- Horário comercial no mesmo formato de grade dos departamentos, agora com horário partido (várias faixas por dia)
- Contatos de uma empresa podem ser cadastrados na aba Contatos do cliente (painel), com cargo; o Atendimento reconhece quem fala por esse telefone
- No painel do contato do atendimento agora dá para ver e editar o cargo de quem fala, e o campo do nome passou a se chamar "Nome"
- A foto do usuário logado (a mesma do painel) aparece no menu do topo, no lugar das iniciais

---

## 2026-07-24 — Sistema ganha forma: áreas separadas, painel de supervisão e uso no celular

- O sistema passou a ter duas áreas: **Atendimento** e **Administração**, ligadas por uma barra no topo com a marca, notificações e o menu do usuário. Ao entrar, cada perfil cai na sua área: administrador na configuração, atendente direto nas conversas
- O menu lateral ficou recolhido em faixa de ícones e **expande ao passar o mouse**, devolvendo espaço para a conversa
- **Painel de supervisão para o administrador**, na área direita das conversas: seis indicadores no topo e duas tabelas, uma por departamento e outra por atendente. Clicar num setor ou numa pessoa **filtra a lista de chamados** na hora, e a seta abre o detalhe de quem tem chamado ativo naquele setor
- O atendente agora **abre um chamado por conta própria**, escolhendo o contato ou a empresa, o departamento e o responsável. Sem responsável o chamado nasce pendente; com responsável já entra em atendimento
- **Quem vê o quê mudou:** o administrador enxerga todos os chamados e atua em qualquer um; o atendente enxerga os seus mais a fila livre de todos os setores, e não vê o chamado que já é de outro colega. O perfil de suporte passou a poder assumir, responder, finalizar e transferir
- **O atendimento funciona no celular:** abrir uma conversa ocupa a tela inteira com botão de voltar, o menu de três pontos reúne dados do atendimento, transferir e finalizar, e a navegação abre em tela cheia ao tocar na foto do usuário
- A conversa foi refinada: foto do contato no cabeçalho, mensagens em coluna centralizada e legível em telas largas, separadores de "Hoje" e "Ontem", confirmação de envio ao lado do horário e orientação quando não há mensagem
- A identidade visual própria do Atendimento (tema escuro) foi aplicada em todas as telas

---

## 2026-07-23 — Projeto criado (planejamento)

- Discovery e decisões de arquitetura concluídos
- Estrutura de documentação criada (CLAUDE.md, PROGRESSO, ROADMAP, docs/*)
- Scaffold Vite base (react-ts)
