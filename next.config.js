/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
};

//module.exports = nextConfig;
module.exports = {
  // Definindo host e porta
  devServer: {
    host: '192.168.4.3', // Aceita conexões de qualquer IP
    port: 3000,      // Define a porta (pode ser 3000 ou outra de sua escolha)
  }
}