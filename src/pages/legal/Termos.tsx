import { PaginaLegal, Secao } from './PaginaLegal'
import { EMPRESA } from '@/lib/empresa'
import { PRODUTO } from '@/lib/produto'

export default function Termos() {
  return (
    <PaginaLegal titulo="Termos de uso">
      <p>
        Ao criar uma conta no {PRODUTO.nome} você concorda com as condições abaixo. Elas estão
        escritas para serem entendidas sem advogado.
      </p>

      <Secao titulo="O que o serviço faz">
        <p>
          O {PRODUTO.nome} é um sistema de gestão de haras: cadastro de plantel, genealogia,
          registros de saúde e reprodução, calendário, relatórios e uma vitrine pública para
          divulgar animais.
        </p>
      </Secao>

      <Secao titulo="Teste e assinatura">
        <p>
          O período de teste dura {PRODUTO.trialDias} dias, sem cartão de crédito. Terminado o
          teste, o registro de novas informações fica bloqueado até a assinatura, mas{' '}
          <strong>seus dados continuam guardados e legíveis</strong> — nada é apagado por falta de
          pagamento.
        </p>
        <p>
          A contratação é feita por contato direto. Não há fidelidade nem multa: você cancela
          quando quiser, e o acesso segue até o fim do período já pago.
        </p>
      </Secao>

      <Secao titulo="Seus dados são seus">
        <p>
          Você continua dono de tudo que cadastra. Não reivindicamos propriedade sobre seus
          registros, fotos ou informações do plantel, e você pode exportar tudo a qualquer momento
          em Configurações.
        </p>
      </Secao>

      <Secao titulo="Suas responsabilidades">
        <p>
          Guardar sua senha, não compartilhar acesso com quem não deve, e responder pelo conteúdo
          que publica na vitrine — inclusive por ter direito de usar as fotos que enviar.
        </p>
        <p>
          É proibido usar o serviço para atividade ilegal, publicar conteúdo de terceiros sem
          autorização, ou tentar acessar dados de outro haras.
        </p>
      </Secao>

      <Secao titulo="Nossas responsabilidades e limites">
        <p>
          Trabalhamos para manter o serviço disponível e íntegro, mas não podemos garantir
          funcionamento ininterrupto: existem manutenções, falhas de provedor e casos fora do
          nosso controle.
        </p>
        <p>
          O {PRODUTO.nome} é ferramenta de registro e organização.{' '}
          <strong>Não substitui orientação veterinária, contábil ou jurídica</strong>, e não
          respondemos por decisões de manejo, reprodução ou negócio tomadas com base nas
          informações do sistema. Os prazos de documentos e registros são um lembrete auxiliar —
          conferir a exigência vigente junto ao órgão ou associação competente continua sendo
          responsabilidade do criador, porque essas regras mudam por estado e por evento.
        </p>
      </Secao>

      <Secao titulo="Encerramento">
        <p>
          Você pode encerrar sua conta quando quiser. Podemos encerrar contas que violem estes
          termos, com aviso prévio e oportunidade de exportar os dados, salvo em caso de uso
          claramente ilegal.
        </p>
      </Secao>

      <Secao titulo="Mudanças nestes termos">
        <p>
          Se houver alteração relevante, avisamos por e-mail com pelo menos 30 dias de
          antecedência. Dúvidas:{' '}
          <a href={`mailto:${EMPRESA.email}`} className="text-primary hover:underline">
            {EMPRESA.email}
          </a>
          .
        </p>
      </Secao>
    </PaginaLegal>
  )
}
