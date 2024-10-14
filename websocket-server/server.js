const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 420 });

wss.on('connection', (ws) => {
  console.log('Novo cliente conectado');

  ws.on('message', (message) => {
    console.log(`Mensagem recebida do cliente: ${message}`);
    ws.send('Mensagem recebida com sucesso!');
  });

  ws.on('close', () => {
    console.log('Cliente desconectado');
  });

  ws.on('error', (error) => {
    console.error('Erro no WebSocket:', error);
  });
      // Enviar mensagem para o cliente a cada 5 segundos
  const interval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send('Mensagem periódica do servidor');
    }
  }, 5000);

  ws.on('close', () => {
    clearInterval(interval);
  });
});

console.log('Servidor WebSocket rodando na porta 420');
