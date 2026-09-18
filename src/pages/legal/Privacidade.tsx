import { PaginaLegal, Secao } from './PaginaLegal'
import { EMPRESA } from '@/lib/empresa'
import { PRODUTO } from '@/lib/produto'

/**
 * Política de privacidade — LGPD (Lei 13.709/2018).
 *
 * O texto descreve o que o sistema REALMENTE faz hoje, verificado contra o
 * código: quais dados são coletados, onde ficam e quem enxerga o quê. Ainda
 * assim, precisa de revisão jurídica antes da primeira cobrança.
 */
export default function Privacidade() {
  return (
    <PaginaLegal titulo="Política de privacidade">
      <p>
        Esta política explica quais dados o {PRODUTO.nome} coleta, por que coleta e o que você
        pode exigir a respeito deles, conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018).
      </p>

      <Secao titulo="Quais dados coletamos">
        <p>
          <strong>Da sua conta:</strong> e-mail e senha. A senha é guardada de forma cifrada pelo
          nosso provedor de autenticação e não é acessível a nós em texto legível.
        </p>
        <p>
          <strong>Do seu haras:</strong> nome, logo e o endereço escolhido para a vitrine.
        </p>
        <p>
          <strong>Do seu plantel:</strong> tudo que você cadastrar — animais, fotos, genealogia,
          registros de saúde e reprodução, pesagens, eventos e anotações.
        </p>
        <p>
          Não coletamos dados de navegação para publicidade, não usamos cookies de rastreamento e
          não há redes de anúncio no sistema.
        </p>
      </Secao>

      <Secao titulo="Como usamos">
        <p>
          Exclusivamente para operar o serviço que você contratou: exibir seu plantel, gerar seus
          relatórios, publicar sua vitrine e avisar sobre prazos. Não vendemos, alugamos nem
          cedemos seus dados a terceiros.
        </p>
      </Secao>

      <Secao titulo="Quem enxerga o quê">
        <p>
          <strong>Seus dados são isolados por conta.</strong> O banco aplica regra de acesso por
          linha: um haras não consegue ler nem alterar os registros de outro, mesmo tentando.
        </p>
        <p>
          <strong>A exceção é a vitrine pública</strong>, e só na medida que você escolher. Ficam
          visíveis para qualquer pessoa com o link apenas os animais que você marcar como
          &ldquo;exibir no link&rdquo;, com nome, foto, pelagem, idade, registro, premiação,
          observações e o nome dos pais. Saúde, reprodução, pesagens, anotações e custos{' '}
          <strong>nunca</strong> aparecem na vitrine.
        </p>
      </Secao>

      <Secao titulo="Onde os dados ficam">
        <p>
          A infraestrutura é do Supabase, e os servidores ficam nos Estados Unidos. Ao usar o
          serviço você concorda com essa transferência internacional, prevista no art. 33 da LGPD.
        </p>
      </Secao>

      <Secao titulo="Seus direitos">
        <p>
          Você pode a qualquer momento pedir acesso, correção, portabilidade ou exclusão dos seus
          dados. A exportação em JSON e CSV está disponível dentro do próprio sistema, em
          Configurações, sem precisar falar com ninguém.
        </p>
        <p>
          Para exclusão de conta, escreva para{' '}
          <a href={`mailto:${EMPRESA.email}`} className="text-primary hover:underline">
            {EMPRESA.email}
          </a>
          . Atendemos em até 15 dias.
        </p>
      </Secao>

      <Secao titulo="Por quanto tempo guardamos">
        <p>
          Enquanto sua conta existir. Após o pedido de exclusão, apagamos em até 30 dias, exceto o
          que a lei exigir manter — registros fiscais, por exemplo.
        </p>
      </Secao>

      <Secao titulo="Contato">
        <p>
          Dúvidas sobre esta política ou sobre seus dados:{' '}
          <a href={`mailto:${EMPRESA.email}`} className="text-primary hover:underline">
            {EMPRESA.email}
          </a>
          .
        </p>
      </Secao>
    </PaginaLegal>
  )
}
