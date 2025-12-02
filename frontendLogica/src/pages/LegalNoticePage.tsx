import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const LegalNoticePage = () => {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <Link to="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver al inicio
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 max-w-4xl">
        <h1 className="text-4xl font-bold mb-8">Aviso Legal</h1>
        
        <div className="prose prose-slate max-w-none space-y-6">
          <p className="text-muted-foreground mb-6">
            Con la finalidad de dar cumplimiento al artículo 10 de la Ley 34/2002 de Servicios de la Sociedad de la Información y Comercio Electrónico, informamos al usuario de nuestros datos:
          </p>

          <section>
            <p className="text-muted-foreground mb-4">
              optimizalo.app está conformado por <strong>José Sabater Delgado</strong>, con DNI <strong>48413424B</strong>.
            </p>
            <p className="text-muted-foreground mb-4">
              Nuestros datos de contacto son los siguientes:
            </p>
            <ul className="list-none pl-0 text-muted-foreground space-y-2">
              <li><strong>e-Mail:</strong> <a href="mailto:contacto@optimizalo.app" className="text-primary hover:underline">contacto@optimizalo.app</a></li>
              <li><strong>Página Web:</strong> <a href="https://optimizalo.app" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">https://optimizalo.app</a></li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Objeto</h2>
            <p className="text-muted-foreground mb-4">
              El prestador, responsable del sitio web, pone a disposición de los usuarios el presente documento con el que pretende dar cumplimiento a las obligaciones dispuestas en la Ley 34/2002, de Servicios de la Sociedad de la Información y del Comercio Electrónico (LSSI-CE), así como informar a todos los usuarios del sitio web respecto a cuáles son las condiciones de uso del sitio web.
            </p>
            <p className="text-muted-foreground mb-4">
              Toda persona que acceda a este sitio web asume el papel de usuario, comprometiéndose a la observancia y cumplimiento riguroso de las disposiciones aquí dispuestas, así como a cualquier otra disposición legal que fuera de aplicación.
            </p>
            <p className="text-muted-foreground mb-4">
              El prestador se reserva el derecho a modificar cualquier tipo de información que pudiera aparecer en el sitio web, sin que exista obligación de preavisar o poner en conocimiento de los usuarios dichas obligaciones, entendiéndose como suficiente con la publicación en el sitio web del prestador.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Responsabilidad</h2>
            <p className="text-muted-foreground mb-4">
              El prestador se exime de cualquier tipo de responsabilidad derivada de la información publicada en su sitio web, siempre que esta información haya sido manipulada o introducida por un tercero ajeno al mismo.
            </p>
            <p className="text-muted-foreground mb-4">
              El sitio web del prestador puede utilizar cookies (pequeños archivos de información que el servidor envía al dispositivo de quien accede a la página). Puedes obtener más información en nuestra{" "}
              <Link to="/politica-cookies" className="text-primary hover:underline">
                Política de cookies
              </Link>.
            </p>
            <p className="text-muted-foreground mb-4">
              Desde el sitio web del cliente es posible que se redirija a contenidos de terceros sitios web. Dado que el prestador no puede controlar siempre los contenidos introducidos por los terceros en sus sitios web, éste no asume ningún tipo de responsabilidad respecto a dichos contenidos. En todo caso, el prestador manifiesta que procederá a la retirada inmediata de cualquier contenido que pudiera contravenir la legislación nacional o internacional, la moral o el orden público, procediendo a la retirada inmediata de la redirección a dicho sitio web, poniendo en conocimiento de las autoridades competentes el contenido en cuestión.
            </p>
            <p className="text-muted-foreground mb-4">
              El prestador no se hace responsable de la información y contenidos almacenados, a título enunciativo pero no limitativo, en foros, chats, generadores de blogs, comentarios, redes sociales o cualquier otro medio que permita a terceros publicar contenidos de forma independiente en la página web del prestador. No obstante y en cumplimiento de lo dispuesto en el art. 11 y 16 de la LSSI-CE, el prestador se pone a disposición de todos los usuarios, autoridades y fuerzas de seguridad, y colaborando de forma activa en la retirada o en su caso bloqueo de todos aquellos contenidos que pudieran afectar o contravenir la legislación nacional, o internacional, derechos de terceros o la moral y el orden público. En caso de que el usuario considere que existe en el sitio web algún contenido que pudiera ser susceptible de esta clasificación, se ruega lo notifique de forma inmediata al administrador del sitio web.
            </p>
            <p className="text-muted-foreground mb-4">
              Este sitio web ha sido revisado y probado para que funcione correctamente. En principio, puede garantizarse el correcto funcionamiento los 365 días del año, 24 horas al día. No obstante, el prestador no descarta la posibilidad de que existan ciertos errores de programación, o que acontezcan causas de fuerza mayor, catástrofes naturales, huelgas, o circunstancias semejantes que hagan imposible el acceso a la página web.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Propiedad Intelectual e industrial</h2>
            <p className="text-muted-foreground mb-4">
              El sitio web, incluyendo a título enunciativo pero no limitativo su programación, edición, compilación y demás elementos necesarios para su funcionamiento, los diseños, logotipos, texto y/o gráficos son propiedad del prestador o en su caso dispone de licencia o autorización expresa por parte de los autores. Todos los contenidos del sitio web se encuentran debidamente protegidos por la normativa de propiedad intelectual e industrial, así como inscritos en los registros públicos correspondientes.
            </p>
            <p className="text-muted-foreground mb-4">
              Independientemente de la finalidad para la que fueran destinados, la reproducción total o parcial, uso, explotación, distribución y comercialización, requiere en todo caso de la autorización escrita previa por parte del prestador. Cualquier uso no autorizado previamente por parte del prestador será considerado un incumplimiento grave de los derechos de propiedad intelectual o industrial del autor.
            </p>
            <p className="text-muted-foreground mb-4">
              Los diseños, logotipos, texto y/o gráficos ajenos al prestador y que pudieran aparecer en el sitio web, pertenecen a sus respectivos propietarios, siendo ellos mismos responsables de cualquier posible controversia que pudiera suscitarse respecto a los mismos. En todo caso, el prestador cuenta con la autorización expresa y previa por parte de los mismos.
            </p>
            <p className="text-muted-foreground mb-4">
              El prestador NO AUTORIZA expresamente a que terceros puedan redirigir directamente a los contenidos concretos del sitio web, debiendo en todo caso redirigir al sitio web principal del prestador.
            </p>
            <p className="text-muted-foreground mb-4">
              El prestador reconoce a favor de sus titulares los correspondientes derechos de propiedad industrial e intelectual, no implicando su sola mención o aparición en el sitio web la existencia de derechos o responsabilidad alguna del prestador sobre los mismos, como tampoco respaldo, patrocinio o recomendación por parte del mismo.
            </p>
            <p className="text-muted-foreground mb-4">
              Para realizar cualquier tipo de observación respecto a posibles incumplimientos de los derechos de propiedad intelectual o industrial, así como sobre cualquiera de los contenidos del sitio web, puede hacerlo a través del correo electrónico{" "}
              <a href="mailto:contacto@optimizalo.app" className="text-primary hover:underline">contacto@optimizalo.app</a>.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Veracidad de la información y menores de edad</h2>
            <p className="text-muted-foreground mb-4">
              Toda la información que facilita el Usuario tiene que ser veraz. A estos efectos, el Usuario garantiza la autenticidad de los datos comunicados a través de los formularios para la suscripción de los Servicios. Será responsabilidad del Usuario mantener toda la información facilitada a JOSÉ SABATER permanentemente actualizada de forma que responda, en cada momento, a su situación real. En todo caso, el Usuario será el único responsable de las manifestaciones falsas o inexactas que realice y de los perjuicios que cause al prestador o a terceros.
            </p>
            <p className="text-muted-foreground mb-4">
              En cuando al uso de los servicios de este sitio web, los menores de edad tienen que obtener siempre previamente el consentimiento de los padres, tutores o representantes legales, responsables últimos de todos los actos realizados por los menores a su cargo. La responsabilidad en la determinación de contenidos concretos a los cuales acceden los menores corresponde a aquellos, es por eso que si acceden a contenidos no apropiados por Internet, se tendrán que establecer en sus ordenadores mecanismos, en particular programas informáticos, filtros y bloqueos, que permitan limitar los contenidos disponibles y, a pesar de que no sean infalibles, son de especial utilidad para controlar y restringir los materiales a los que pueden acceder los menores.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Obligación de hacer un uso correcto de la Web</h2>
            <p className="text-muted-foreground mb-4">
              El Usuario se compromete a utilizar la Web de conformidad a la Ley y al presente Aviso Legal, así como a la moral y a buenas costumbres. A tal efecto, el Usuario se abstendrá de utilizar la página con finalidades ilícitas o prohibidas, lesivas de derechos e intereses de terceros, o que de cualquier forma puedan dañar, inutilizar, sobrecargar, deteriorar o impedir la normal utilización de equipos informáticos o documentos, archivos y toda clase de contenidos almacenados en cualquier equipo informático del prestador.
            </p>
            <p className="text-muted-foreground mb-4">
              En particular, y a título indicativo pero no exhaustivo, el Usuario se compromete a no transmitir, difundir o poner a disposición de terceros informaciones, datos, contenidos, mensajes, gráficos, dibujos, archivos de sonido o imagen, fotografías, grabaciones, software y, en general, cualquier clase de material que:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>(a) sea contraria, desprecie o atente contra los derechos fundamentales y las libertades públicas reconocidas constitucionalmente, en tratados internacionales y otras normas vigentes;</li>
              <li>(b) induzca, incite o promueva actuaciones delictivas, denigrantes, difamatorias, violentas o, en general, contrarias a la ley, a la moral y al orden público;</li>
              <li>(c) induzca, incite o promueva actuaciones, actitudes o pensamientos discriminatorios por razón de sexo, raza, religión, creencias, edad o condición;</li>
              <li>(d) sea contrario al derecho al honor, a la intimidad personal o familiar o a la propia imagen de las personas;</li>
              <li>(e) de cualquier manera perjudique la credibilidad del prestador o de terceros; y</li>
              <li>(f) constituya publicidad ilícita, engañosa o desleal.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Ley Aplicable y Jurisdicción</h2>
            <p className="text-muted-foreground mb-4">
              Para la resolución de todas las controversias o cuestiones relacionadas con el presente sitio web o de las actividades en él desarrolladas, será de aplicación la legislación española, a la que se someten expresamente las partes, siendo competentes para la resolución de todos los conflictos derivados o relacionados con su uso los Juzgados y Tribunales de Paterna.
            </p>
          </section>

          <p className="text-sm text-muted-foreground mt-8">
            Última actualización: {new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </main>
    </div>
  );
};

export default LegalNoticePage;