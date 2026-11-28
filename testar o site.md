### abra 2 terminais

um dentro em -> /GestaoEspacos

**-> rode "npm start"**

inicia o backend em http://localhost:3080


outro em -> /GestaoEspacos/frontend

**-> rode "npm run dev"**

incia o front em http://localhost:5173/ acesse esse link para ir para o site


##### obs:

o login gera um token de sessão que dura **8 horas** (depois disso o site manda fazer login de novo). O tempo fica no `expiresIn` dentro de _src/routes/loginRoutes.js_

**se deu pull e o back nao sobe** (erro "Cannot find module 'nodemailer'"): roda **"npm install"** dentro de /GestaoEspacos (o envio de e-mail usa 2 bibliotecas novas no back)


---

### QR code do check-in (o que precisa pra rodar)

**1. instalar as bibliotecas novas (so precisa uma vez)**

o qr code usa 2 bibliotecas novas: `qrcode.react` (desenha o qr pro cliente) e `jsqr` (le o qr pela camera)

dentro de -> /GestaoEspacos/frontend

**-> rode "npm install"**

se nao rodar isso o front nem abre, da erro de "Failed to resolve import qrcode.react"

**2. ter uma reserva aprovada**

o qr so existe depois que a reserva é aprovada (o banco cria ele sozinho na aprovaçao)

- entra como **cliente** e faz uma reserva (Espaços -> escolhe a sala -> Solicitar reserva)
- entra como **funcionario ou adm** e aprova em **Gestão de reservas**

dica: marca a reserva pra hoje, pq a entrada so é liberada **30 min antes do horario** e o qr para de valer quando o horario acaba

**3. cliente abre o qr**

- entra como **cliente** -> **Minhas Reservas**
- na reserva aprovada clica em **"Ver QR Code"**
- abre o qr com o codigo escrito embaixo (clicando no codigo ele copia)

**4. recepçao le o qr**

- entra como **funcionario ou adm** -> **Check-in**
- tem 3 jeitos de ler:
  - **camera:** clica em **"Ler com a câmera"**, o navegador pede permissao (clica em permitir), mostra o qr do celular na frente da webcam e ele ja busca sozinho
  - **leitor usb:** clica no campo e le, ele digita o codigo e da enter sozinho
  - **digitando:** cola o codigo que aparece embaixo do qr e clica em buscar
- aparece o cartao do cliente -> **"Registrar entrada"**
- quando ele for embora -> **"Registrar saída"**

**obs da camera:**

- so funciona abrindo o site por **http://localhost:5173** (o navegador so libera camera em localhost ou https, pelo ip da rede ele bloqueia)
- se negou a permissao sem querer: clica no cadeado do lado do endereço -> camera -> permitir, e tenta de novo
- se outro programa estiver usando a webcam (teams, meet, discord) fecha ele antes
- se o computador nao tiver camera, usa o jeito de digitar/colar o codigo

**erros que podem aparecer no check-in (é normal, é o back conferindo):**

- "Ainda é cedo" -> faltam mais de 30 min pro horario
- "QR Code expirado" -> o horario da reserva ja acabou
- "A entrada já foi registrada" -> ja fizeram o check-in dessa reserva
- "QR Code inválido" -> o codigo nao é do sistema

---

### equipamentos na reserva

- entra como **cliente** -> **Espaços** -> escolhe uma sala que tenha equipamento (ex: Sala de Reunião Ipê) -> **Solicitar reserva**
- embaixo do formulario aparece a caixinha **Equipamentos (opcional)** com a quantidade de cada um (vai de 0 ate o que tem no estoque)
- a reserva e os equipamentos sao gravados juntos: se pedir mais do que tem, da erro e **nada** é gravado
- os equipamentos pedidos aparecem em **Minhas Reservas** e na **Gestão de reservas** (embaixo do nome da sala, pra recepçao saber o que separar)
- se a sala nao tiver equipamento cadastrado a caixinha nem aparece

---

### calendário

- menu **Calendário** (todo mundo ve)
- escolhe a sala no select e a visao: **Mês**, **Semana** ou **Dia** (as setas andam pra frente/tras, "Hoje" volta pro dia de hoje)
- cores: **verde** livre, **vermelho** ocupado, **azul** reserva sua, **cinza** bloqueado (manutençao/evento)
- clicando num dia abre a visao do dia; clicando num horario **livre** abre a tela de reserva ja com a data e o horario preenchidos
- na tela de reserva tem o link **"Ver horários livres e ocupados no calendário"** que ja abre na sala certa
- o cliente nao ve o nome de quem reservou, so que ta ocupado

---

### notificações e e-mail

o banco cria uma notificaçao sozinho quando a reserva é criada, aprovada, recusada ou cancelada. o back olha essa fila a cada 20 segundos e manda por e-mail. no e-mail de **reserva aprovada** vai junto a **imagem do QR code** pra mostrar na recepçao

- menu **Notificações**: cada um ve as suas, com "Enviada por e-mail em ..." ou "Na fila de envio"
- funcionario e adm tem a aba **"Todas do sistema"**

**modo teste (padrao, nao precisa configurar nada):**

- os e-mails sao salvos como arquivo na pasta **/GestaoEspacos/emails-teste** (ex: `notificacao-31.eml`)
- da dois cliques no arquivo que abre no outlook/email do windows e mostra o e-mail igualzinho, com o qr
- no terminal do back aparece `[e-mail teste] "Reserva #16 APROVADA" para ... -> emails-teste/notificacao-31.eml`

**pra mandar e-mail de verdade:**

1. copia o arquivo **.env.email.exemplo** com o nome **.env.email** (na pasta /GestaoEspacos)
2. preenche com o servidor de e-mail. no gmail precisa ativar a verificaçao em 2 etapas e criar uma **senha de app** (conta google -> segurança -> senhas de app), a senha normal nao funciona
3. reinicia o back (`npm start`), no terminal tem que aparecer "Envio de e-mail ligado"

obs: o **.env.email nao vai pro git** (ta no .gitignore) pq tem senha. cada um cria o seu
obs 2: os usuarios de exemplo do banco tem e-mail inventado, entao pra testar de verdade cria uma conta com o seu e-mail
obs 3: whatsapp/telegram ficam so na fila, nao tem integraçao (precisaria de conta paga/bot)
