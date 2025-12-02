import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const PrivacyPolicyPage = () => {
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
        <h1 className="text-4xl font-bold mb-8">Política de Privacidad</h1>
        
        <div className="prose prose-slate max-w-none space-y-6">
          <p className="text-muted-foreground mb-6">
            La presente política de privacidad describe las formas en la que recogemos la información, con qué fin la utilizamos y cómo la gestionamos. Su privacidad es importante para nosotros y le otorgamos una gran importancia, por eso deseamos expresar el máximo compromiso con la protección de los datos personales de nuestros Usuarios. Hemos implementado las medidas técnicas y organizativas necesarias que indica la normativa de protección de datos para asegurar la confidencialidad de sus datos, dando cumplimiento al Reglamento General de Protección de Datos aprobado por la Unión Europea (RGPD) y a la Ley Orgánica 3/2018 de 5 de diciembre (LOPDGDD).
          </p>

          <section>
            <h2 className="text-2xl font-semibold mb-4">¿Quién es el responsable del tratamiento?</h2>
            <p className="text-muted-foreground mb-4">
              optimizalo.app está conformado por <strong>José Sabater Delgado</strong> con DNI <strong>48413424B</strong>.
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
            <h2 className="text-2xl font-semibold mb-4">¿Cuáles son las finalidades del tratamiento? ¿Cuál es la legitimación del tratamiento?</h2>
            <p className="text-muted-foreground mb-4">
              Los datos personales de los interesados se tratarán por optimizalo.app de acuerdo con las siguientes finalidades, dependiendo del momento en el que se aporte dicha información:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-3">
              <li>Con el objeto de atender sus consultas o enviarle información relacionada con su solicitud, puede ser necesario que obtengamos información por su parte, en tal caso, le solicitaremos que nos la proporcione voluntariamente de forma expresa. Únicamente debe enviarnos los datos de los que usted es titular, o bien de terceros, si es su representante legal o ha obtenido su consentimiento inequívoco. La base jurídica del tratamiento se corresponde con el art. 6.1 a) RGPD (consentimiento del interesado).</li>
              <li>Gestionar las suscripciones para recibir información comercial sobre optimizalo.app, para lo que se recaba el consentimiento del interesado en nuestra newsletter, a través de los mecanismos habilitados al respecto en la web. El tratamiento está basado en el art. 6.1 a) RGPD (consentimiento del interesado), el cual puede ser retirado en cualquier momento sin que ello afecte a la licitud del tratamiento previo a su retirada.</li>
              <li>Para fines analíticos y/o estadísticos, en el caso de que usted acepte las cookies utilizadas por el sitio web para estas finalidades. El tratamiento se basa en el consentimiento recabado al usuario, de acuerdo con el artículo 6.1 a) RGPD y art. 22 LSSI.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">¿Cuáles son los criterios de conservación de los datos?</h2>
            <p className="text-muted-foreground mb-4">
              Conservaremos sus datos durante el tiempo estrictamente imprescindible para dar cumplimiento a la finalidad para la que fueron recabados y, en todo caso, hasta que usted no revoque su consentimiento.
            </p>
            <p className="text-muted-foreground mb-4">
              Independientemente de que tratemos tus datos durante el tiempo estrictamente necesario para cumplir con la finalidad correspondiente, los conservaremos posteriormente debidamente guardados y protegidos durante el tiempo en que pudieran surgir responsabilidades derivadas del tratamiento, en cumplimiento con la normativa vigente en cada momento.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">¿Cómo debo actualizar mis datos personales?</h2>
            <p className="text-muted-foreground mb-4">
              El Usuario garantiza que los datos personales que nos ha facilitado a través de este sitio web son veraces, correctos, actuales y completos. El Usuario deberá comunicarnos cualquier modificación o actualización de los mismos, mediante el envío de una comunicación a la dirección electrónica{" "}
              <a href="mailto:contacto@optimizalo.app" className="text-primary hover:underline">contacto@optimizalo.app</a>.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">¿Cuáles son los destinatarios de la información?</h2>
            <p className="text-muted-foreground mb-4">
              No cederemos información a terceros salvo obligación legal y las necesarias para prestar los servicios, o bien en el caso de que usted preste su consentimiento expreso e inequívoco.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">¿Existen transferencias internacionales de datos?</h2>
            <p className="text-muted-foreground mb-4">
              optimizalo.app procura elegir proveedores que están situados en la Unión Europea, no obstante, puede utilizar proveedores de servicios y procesadores de datos los cuales se sitúen en otros territorios realizándose transferencias internacionales de datos.
            </p>
            <p className="text-muted-foreground mb-4">
              En tales casos siempre haremos nuestro mayor esfuerzo para garantizar que todos los terceros con los que trabajamos mantengan la seguridad de tus datos personales y adoptaremos cuantas garantías sean necesarias para ello, dando cumplimiento a lo establecido en la normativa de protección de datos personales. Puedes obtener más información dirigiéndote a{" "}
              <a href="mailto:contacto@optimizalo.app" className="text-primary hover:underline">contacto@optimizalo.app</a>.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">¿Qué derechos tienen los interesados?</h2>
            <p className="text-muted-foreground mb-4">
              Cualquier persona tiene derecho a obtener confirmación sobre si estamos tratando datos personales que les conciernan, o no. Las personas interesadas tienen derecho a si acceder a sus datos personales, así como a solicitar la rectificación de los datos inexactos o, en su caso, solicitar su supresión cuando, entre otros motivos, los datos ya no sean necesarios para los fines que fueron recogidos.
            </p>
            <p className="text-muted-foreground mb-4">
              En determinadas circunstancias, los interesados podrán solicitar la limitación del tratamiento de sus datos, en cuyo caso únicamente los conservaremos para el ejercicio o la defensa de reclamaciones. En determinadas circunstancias y por motivos relacionados con su situación particular, los interesados podrán oponerse al tratamiento de sus datos. En este caso dejaremos de tratar los datos, salvo por motivos legítimos imperiosos, o el ejercicio o la defensa de posibles reclamaciones. También tendrán derecho a retirar el consentimiento al tratamiento de sus datos en cualquier momento cuando la base que legítima el mismo sea la obtención del propio consentimiento del interesado.
            </p>
            <p className="text-muted-foreground mb-4">
              Podrán presentar una reclamación ante la Autoridad de Control en materia de Protección de Datos competente, como la Agencia Española de Protección de datos, especialmente cuando no haya obtenido satisfacción en el ejercicio de sus derechos o crea que el tratamiento de datos no es adecuado con la legalidad vigente.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">¿Dónde puede ejercer los derechos?</h2>
            <p className="text-muted-foreground mb-4">
              Mediante el envío de un correo electrónico a la dirección{" "}
              <a href="mailto:contacto@optimizalo.app" className="text-primary hover:underline">contacto@optimizalo.app</a>, identificándose y concretando su solicitud.
            </p>
            <p className="text-muted-foreground mb-4">
              En las comunicaciones comerciales incluido los newsletter usted podrá revocar el consentimiento otorgado mediante el envío de un correo electrónico a nuestra dirección{" "}
              <a href="mailto:contacto@optimizalo.app" className="text-primary hover:underline">contacto@optimizalo.app</a>{" "}
              indicando en el mensaje la frase "Baja del Servicio de Comunicaciones", o bien pulsando sobre el enlace de baja si en el mensaje del correo así se indica.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Medidas de seguridad</h2>
            <p className="text-muted-foreground mb-4">
              Que de conformidad con lo dispuesto en las normativas vigentes en protección de datos personales, los corresponsables están cumpliendo con todas las disposiciones del REGLAMENTO GENERAL DE PROTECCION DE DATOS (RGPD) para el tratamiento de los datos personales de su responsabilidad, y manifiestamente con los principios descritos en el artículo 5, por los cuales son tratados de manera lícita, leal y transparente en relación con el interesado y adecuados, pertinentes y limitados a lo necesario en relación con los fines para los que son tratados. Los corresponsables garantizan que han implementado políticas técnicas y organizativas apropiadas para aplicar las medidas de seguridad que establecen el RGPD con el fin de proteger los derechos y libertades de los Usuarios y les ha comunicado la información adecuada para que puedan ejercerlos.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Aceptación y consentimiento</h2>
            <p className="text-muted-foreground mb-4">
              El usuario manifiesta que ha sido informado sobre nuestra política de protección de datos y consiente su tratamiento con las finalidades expresadas anteriormente. Se advierte que algunos de los servicios prestados en la Web podrán tener condiciones particulares, en tal caso se informará debidamente a los usuarios.
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

export default PrivacyPolicyPage;