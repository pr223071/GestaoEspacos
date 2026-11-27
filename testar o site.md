### abra 2 terminais

um dentro em -> /GestaoEspacos

**-> rode "npm start"**

inicia o backend em http://localhost:3080


outro em -> /GestaoEspacos/frontend

**-> rode "npm run dev"**

incia o front em http://localhost:5173/ acesse esse link para ir para o site


##### obs:

o site tem um token de sessão que expira em 30 segundos, usado para teste. O codigo do tempo esta dentro do _Login.js_


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