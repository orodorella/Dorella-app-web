import Link from 'next/link';

const FAQ_ITEMS = [
  {
    question: '¿Dónde están ubicados?',
    answer:
      'Estamos ubicados en Cali, Colombia. También atendemos clientes de otras ciudades por medio de nuestros canales digitales.',
  },
  {
    question: '¿Hacen envíos?',
    answer:
      'Sí. Realizamos envíos a todo el país. Los tiempos y costos pueden variar según la ciudad de destino.',
  },
  {
    question: '¿Qué garantía tiene el oro laminado?',
    answer:
      'Nuestras joyas en oro laminado 18K cuentan con garantía de 2 años, válida únicamente por cambio de tono del oro laminado, bajo condiciones normales de uso.',
  },
  {
    question: '¿Qué no cubre la garantía?',
    answer:
      'La garantía no cubre daños físicos o por uso, como roturas, reventadas, balines abollados, rayones, limaduras, manipulación, ni deterioro causado por ácidos o químicos corrosivos.',
  },
  {
    question: '¿Cómo hago válida una garantía?',
    answer:
      'Para iniciar el proceso, debes escribirnos por WhatsApp con foto o video de la joya, tu nombre y la factura. Luego revisaremos el caso y te indicaremos los pasos a seguir.',
  },
  {
    question: '¿Quién cubre los costos de envío en una garantía?',
    answer:
      'Los costos de fletes y transporte corren por cuenta del cliente.',
  },
  {
    question: '¿Puedo comprar por mayor?',
    answer:
      'Sí. Tenemos niveles para clientes Por Mayor y Gran Mayor. Si quieres subir de nivel, puedes escribirnos por WhatsApp y te contamos los requisitos.',
  },
  {
    question: '¿Qué hago si tengo una duda adicional?',
    answer:
      'Si tienes alguna duda adicional, no dudes en escribirnos por WhatsApp. Te acompañamos en el proceso.',
  },
] as const;

const WHATSAPP_HREF =
  'https://wa.me/573156343383?text=Hola%21%20tengo%20una%20duda%20sobre%20D%27orella.%20%C2%BFMe%20pueden%20ayudar%3F';

export default function HomeFaq() {
  return (
    <section id="preguntas-frecuentes" className="bg-[#fcf7f0] py-24 sm:py-28">
      <div className="max-w-[1100px] mx-auto px-6">
        <div className="max-w-2xl mb-14">
          <p className="text-[10px] text-gold uppercase tracking-[0.4em] mb-4 font-medium">Atención D&apos;orella</p>
          <h2
            className="text-[clamp(2rem,4vw,3.2rem)] text-stone-900"
            style={{ fontFamily: 'var(--font-serif)' }}
          >
            Preguntas frecuentes
          </h2>
          <p className="text-stone-500 text-sm sm:text-base mt-4 leading-7">
            Resolvemos las dudas más comunes antes de tu compra.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {FAQ_ITEMS.map((item) => (
            <details
              key={item.question}
              className="group rounded-[18px] border border-stone-200/80 bg-white/88 px-5 py-4 shadow-[0_12px_36px_-28px_rgba(91,14,22,0.35)]"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left">
                <span
                  className="text-[1.02rem] text-stone-800"
                  style={{ fontFamily: 'var(--font-serif)' }}
                >
                  {item.question}
                </span>
                <span className="mt-0.5 text-gold transition-transform duration-300 group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="pt-4 pr-6 text-sm leading-7 text-stone-500">
                {item.answer}
              </p>
            </details>
          ))}
        </div>

        <div className="mt-12 rounded-[24px] border border-gold/20 bg-[linear-gradient(135deg,rgba(91,14,22,0.04),rgba(201,168,76,0.08))] px-6 py-7 sm:px-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p
                className="text-[1.4rem] text-stone-900"
                style={{ fontFamily: 'var(--font-serif)' }}
              >
                ¿Tienes otra pregunta?
              </p>
              <p className="text-sm text-stone-500 mt-2">
                Nuestro equipo te acompaña antes, durante y después de tu compra.
              </p>
            </div>

            <Link
              href={WHATSAPP_HREF}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center border border-wine/20 bg-white px-6 py-3 text-[11px] font-medium uppercase tracking-[0.14em] text-wine transition-all hover:border-gold/45 hover:text-gold hover:bg-white/90"
            >
              Escríbenos por WhatsApp
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
