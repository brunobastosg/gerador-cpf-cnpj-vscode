import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { gerarCPF, gerarCNPJ } from './gerador';
import { ResultadoValidacao, validarCPF, validarCNPJ } from './validador';

export const configuracaoMcpSchema = z.object({
    somenteNumeros: z.boolean(),
    habilitarCnpjAlfanumerico: z.boolean(),
}).strict();

export type ConfiguracaoMcp = z.infer<typeof configuracaoMcpSchema>;

const somenteNumerosSchema = z.boolean().optional().describe(
    'Sobrescreve a configuração da extensão apenas nesta chamada. Use false para "formatado" ou "com formatação"; true para "sem máscara" ou "sem formatação". No CNPJ alfanumérico, sem máscara preserva as letras. Omita para usar a configuração da extensão.'
);
const quantidadeSchema = z.number().int().min(1).max(100).default(1).describe(
    'Quantidade de documentos distintos neste lote, de 1 a 100. Padrão: 1. Não há garantia de unicidade entre chamadas diferentes.'
);
const resultadoGeracaoSchema = { documentos: z.array(z.string()).min(1).max(100) };
const resultadoValidacaoSchema = { valido: z.boolean(), motivo: z.string().optional() };
const anotacoes = { readOnlyHint: true, destructiveHint: false, openWorldHint: false };

export function criarServidorMcp(configuracao: ConfiguracaoMcp): McpServer {
    const padroes = configuracaoMcpSchema.parse(configuracao);
    const servidor = new McpServer({ name: 'gerador-cpf-cnpj', version: '1.0.0' }, {
        instructions: 'Gere e valide CPF/CNPJ para testes. As ferramentas não editam arquivos. Quando o pedido envolver preencher um arquivo, use os documentos retornados com as ferramentas de edição do cliente; caso contrário, responda no chat. Validade dos DVs não comprova existência ou situação cadastral.',
    });

    servidor.registerTool('gerar_cpf', {
        title: 'Gerar CPF',
        description: 'Gera um ou vários CPFs válidos para testes, distintos dentro do lote. Respeita a configuração de formatação da extensão, salvo override explícito. Para "CPF formatado" ou "CPF com formatação", envie somenteNumeros: false. Retorna dados, sem editar arquivos.',
        inputSchema: { somenteNumeros: somenteNumerosSchema, quantidade: quantidadeSchema },
        outputSchema: resultadoGeracaoSchema,
        annotations: { ...anotacoes, title: 'Gerar CPF', idempotentHint: false },
    }, ({ somenteNumeros, quantidade }) => gerarLote(
        quantidade, () => gerarCPF(somenteNumeros ?? padroes.somenteNumeros), validarCPF
    ));

    servidor.registerTool('gerar_cnpj', {
        title: 'Gerar CNPJ',
        description: 'Gera um ou vários CNPJs válidos para testes, distintos dentro do lote. Formatação e modo alfanumérico respeitam a extensão, salvo overrides explícitos independentes. Para "CNPJ numérico formatado", envie habilitarCnpjAlfanumerico: false e somenteNumeros: false. Retorna dados, sem editar arquivos.',
        inputSchema: {
            somenteNumeros: somenteNumerosSchema,
            habilitarCnpjAlfanumerico: z.boolean().optional().describe(
                'Sobrescreve a configuração da extensão apenas nesta chamada. Use false para "CNPJ numérico" (sem letras); true para "CNPJ alfanumérico" (permite letras maiúsculas na base). Independente da máscara. Omita para usar a configuração da extensão.'
            ),
            quantidade: quantidadeSchema,
        },
        outputSchema: resultadoGeracaoSchema,
        annotations: { ...anotacoes, title: 'Gerar CNPJ', idempotentHint: false },
    }, ({ somenteNumeros, habilitarCnpjAlfanumerico, quantidade }) => gerarLote(
        quantidade,
        () => gerarCNPJ(somenteNumeros ?? padroes.somenteNumeros, habilitarCnpjAlfanumerico ?? padroes.habilitarCnpjAlfanumerico),
        validarCNPJ
    ));

    servidor.registerTool('validar_cpf', {
        title: 'Validar CPF',
        description: 'Confere os dois dígitos verificadores de um CPF, com ou sem a máscara convencional. Rejeita formato inválido e sequências repetidas. Não consulta existência, titularidade ou situação cadastral.',
        inputSchema: { cpf: z.string().describe('CPF com 11 números, sem máscara ou no formato 000.000.002-72.') },
        outputSchema: resultadoValidacaoSchema,
        annotations: { ...anotacoes, title: 'Validar CPF', idempotentHint: true },
    }, ({ cpf }) => resultado(validarCPF(cpf)));

    servidor.registerTool('validar_cnpj', {
        title: 'Validar CNPJ',
        description: 'Confere os dois dígitos verificadores de um CNPJ numérico ou alfanumérico, independentemente da configuração de geração. Aceita sem máscara ou com a máscara convencional, com letras maiúsculas na base e DVs numéricos. Rejeita formato inválido e sequências repetidas. Não consulta existência, titularidade ou situação cadastral.',
        inputSchema: { cnpj: z.string().describe('CNPJ de 14 caracteres, sem máscara ou no formato 12.ABC.345/01DE-35. Letras devem ser maiúsculas e os dois DVs devem ser numéricos.') },
        outputSchema: resultadoValidacaoSchema,
        annotations: { ...anotacoes, title: 'Validar CNPJ', idempotentHint: true },
    }, ({ cnpj }) => resultado(validarCNPJ(cnpj)));

    return servidor;
}

function gerarLote(quantidade: number, gerar: () => string, validar: (documento: string) => ResultadoValidacao): CallToolResult {
    const documentos = new Set<string>();
    for (let tentativa = 0; documentos.size < quantidade && tentativa < quantidade * 100; tentativa++) {
        const documento = gerar();
        if (validar(documento).valido) {
            documentos.add(documento);
        }
    }
    if (documentos.size !== quantidade) {
        return {
            isError: true,
            content: [{ type: 'text', text: 'Não foi possível gerar o lote completo de documentos válidos e distintos. Tente novamente.' }],
        };
    }
    return resultado({ documentos: [...documentos] });
}

function resultado(dados: { documentos: string[] } | ResultadoValidacao): CallToolResult {
    return { content: [{ type: 'text', text: JSON.stringify(dados) }], structuredContent: dados };
}
