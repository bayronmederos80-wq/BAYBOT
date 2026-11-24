const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, downloadContentFromMessage } = require('@whiskeysockets/baileys')
const qrcode = require('qrcode-terminal')

let saldo = {}
function getSaldo(id){ if(!saldo[id]) saldo[id]=1000; return saldo[id] }

async function start(){
  const { state, saveCreds } = await useMultiFileAuthState('sesion')
  const sock = makeWASocket({ auth: state, printQRInTerminal: true, browser: ['BayBot','Chrome','1.0.0'] })
  sock.ev.on('creds.update', saveCreds)
  sock.ev.on('connection.update', ({connection, lastDisconnect, qr})=>{
    if(qr) qrcode.generate(qr, {small:true})
    if(connection==='close'){
      if(lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) start()
    }
    if(connection==='open') console.log('BOT CONECTADO')
  })

  sock.ev.on('messages.upsert', async ({messages})=>{
    const m = messages[0]
    if(!m.message || m.key.fromMe) return
    const jid = m.key.remoteJid
    const id = m.key.participant || jid
    const texto = (m.message.conversation || m.message.extendedTextMessage?.text || m.message.imageMessage?.caption || '').trim()
    const enviar = async (txt) => { await sock.sendMessage(jid, {text: txt}, {quoted: m}) }
    const citado = m.message.extendedTextMessage?.contextInfo?.quotedMessage

    if(!texto.startsWith('.')) return
    const args = texto.slice(1).split(' ')
    const cmd = args[0].toLowerCase()
    const resto = args.slice(1).join(' ')

    // 1. MENU
    if(cmd==='menu') return enviar(`🤖 *MENU BAY BOT* 🤖\n\n.menu - Ver este menu\n.code - Ver codigo del bot\n.view - Ver foto de una sola vez (respondiendo a la foto)\n.spotify [cancion] - Buscar en Spotify\n.play [cancion] - Buscar en YouTube\n.sticker / .s - Hacer sticker (mandando foto con .s)\n.ppt [piedra/papel/tijera] - Jugar ppt\n.bet [monto] [cara/cruz] - Apostar`)

    // 2. CODE
    if(cmd==='code') return enviar(`💻 *CODIGO BAY BOT*\n\nRepo: https://github.com/tu-usuario/baybot\nHost: https://railway.app\n\nSi queres tu propio bot, copia el repo y prendelo en Railway.`)

    // 3. VIEW - ver foto de una sola vez
    if(cmd==='view'){
      if(!citado) return enviar('Respondé a una foto de una sola vez con .view')
      try{
        const msgView = citado.viewOnceMessageV2?.message || citado.viewOnceMessage?.message || citado
        const img = msgView.imageMessage || msgView.videoMessage
        if(!img) return enviar('Eso no es una foto de una sola vez')
        const stream = await downloadContentFromMessage(img, img.mimetype.includes('video') ? 'video' : 'image')
        let buffer = Buffer.from([])
        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk])
        await sock.sendMessage(jid, { image: buffer, caption: '👀 Foto recuperada con .view' }, {quoted: m})
      }catch(e){ return enviar('No pude ver esa foto, mandala de nuevo') }
      return
    }

    // 4. SPOTIFY
    if(cmd==='spotify'){
      if(!resto) return enviar('Uso: .spotify bad bunny')
      const link = `https://open.spotify.com/search/${encodeURIComponent(resto)}`
      return enviar(`🎵 *Spotify*\nBuscando: ${resto}\n\nEscuchalo acá:\n${link}`)
    }

    // 5. PLAY
    if(cmd==='play'){
      if(!resto) return enviar('Uso: .play duki - no me conocen')
      const link = `https://www.youtube.com/results?search_query=${encodeURIComponent(resto)}`
      return enviar(`▶️ *Play*\nCanción: ${resto}\n\nEscuchala acá:\n${link}`)
    }

    // 6. STICKER / S
    if(cmd==='sticker' || cmd==='s'){
      const imgMsg = m.message.imageMessage || citado?.imageMessage
      if(!imgMsg) return enviar('Mandá una foto con el texto .s o respondé a una foto con .s')
      try{
        const stream = await downloadContentFromMessage(imgMsg, 'image')
        let buffer = Buffer.from([])
        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk])
        await sock.sendMessage(jid, { sticker: buffer }, {quoted: m})
      }catch(e){ return enviar('No pude hacer el sticker, probá con otra foto') }
      return
    }

    // 7. PPT - Piedra Papel Tijera
    if(cmd==='ppt'){
      const eleccion = (resto || '').toLowerCase()
      if(!['piedra','papel','tijera'].includes(eleccion)) return enviar('Uso: .ppt piedra / .ppt papel / .ppt tijera')
      const bot = ['piedra','papel','tijera'][Math.floor(Math.random()*3)]
      let res = ''
      if(eleccion===bot) res='Empate 😐'
      else if((eleccion==='piedra'&&bot==='tijera')||(eleccion==='papel'&&bot==='piedra')||(eleccion==='tijera'&&bot==='papel')) res='Ganaste! 🎉'
      else res='Perdiste 😢'
      return enviar(`✊✋✌️ *PPT*\nVos: ${eleccion}\nBot: ${bot}\n\n${res}`)
    }

    // 8. BET
    if(cmd==='bet'){
      let monto = parseInt(args[1]) || 0
      let elec = (args[2]||'').toLowerCase()
      if(monto<=0 || !['cara','cruz'].includes(elec)) return enviar('Uso: .bet 100 cara / .bet 100 cruz\nTenes: '+getSaldo(id))
      if(getSaldo(id) < monto) return enviar('No tenes tanta plata. Saldo: '+getSaldo(id))
      let res = Math.random()<0.5 ? 'cara':'cruz'
      if(res===elec){ saldo[id]=getSaldo(id)+monto; return enviar(`🪙 Salió ${res} GANASTE ${monto}\nSaldo: ${saldo[id]}`) }
      saldo[id]=getSaldo(id)-monto; return enviar(`🪙 Salió ${res} PERDISTE ${monto}\nSaldo: ${saldo[id]}`)
    }
  })
}
start()
