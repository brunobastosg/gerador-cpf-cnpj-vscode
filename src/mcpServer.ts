import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { configuracaoMcpSchema, criarServidorMcp } from './mcp';

async function main() {
    const entrada = process.env.GERADOR_CPF_CNPJ_CONFIG;
    if (entrada === undefined) {
        throw new Error('Configuração GERADOR_CPF_CNPJ_CONFIG não informada pela extensão.');
    }
    const configuracao = configuracaoMcpSchema.parse(JSON.parse(entrada));
    const servidor = criarServidorMcp(configuracao);
    await servidor.connect(new StdioServerTransport());
}

main().catch((erro: unknown) => {
    console.error('Falha ao iniciar o MCP Gerador de CPF/CNPJ:', erro);
    process.exitCode = 1;
});
