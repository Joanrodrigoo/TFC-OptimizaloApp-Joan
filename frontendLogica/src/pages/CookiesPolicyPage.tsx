import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const CookiesPolicyPage = () => {
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
        <h1 className="text-4xl font-bold mb-8">Política de Cookies</h1>
        
        <div className="prose prose-slate max-w-none space-y-6">
          <p className="text-muted-foreground mb-6">
            Esta política de cookies fue actualizada por última vez el 5 de julio de 2023 y se aplica a los ciudadanos y residentes legales permanentes del Espacio Económico Europeo y Suiza.
          </p>

          <section>
            <h2 className="text-2xl font-semibold mb-4">1. Introducción</h2>
            <p className="text-muted-foreground mb-4">
              Nuestra web, <a href="https://optimizalo.app" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">https://optimizalo.app</a> (en adelante: «la web») utiliza cookies y otras tecnologías relacionadas (para mayor comodidad, todas las tecnologías se denominan «cookies»). Las cookies también son colocadas por terceros a los que hemos contratado. En el siguiente documento te informamos sobre el uso de cookies en nuestra web.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">2. ¿Qué son las cookies?</h2>
            <p className="text-muted-foreground mb-4">
              Una cookie es un pequeño archivo que se envía junto con las páginas de esta web y que tu navegador almacena en el disco duro de su ordenador u otro dispositivo. La información almacenada puede ser devuelta a nuestros servidores o a los servidores de terceros apropiados durante una visita posterior.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">3. ¿Qué son los scripts?</h2>
            <p className="text-muted-foreground mb-4">
              Un script es un fragmento de código de programa que se utiliza para hacer que nuestra web funcione correctamente y de forma interactiva. Este código se ejecuta en nuestro servidor o en tu dispositivo.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">4. ¿Qué es una baliza web?</h2>
            <p className="text-muted-foreground mb-4">
              Una baliza web (o una etiqueta de píxel) es una pequeña e invisible pieza de texto o imagen en una web que se utiliza para monitorear el tráfico en una web. Para ello, se almacenan varios datos sobre usted mediante estas balizas web.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">5. Cookies</h2>
            
            <div className="space-y-4 mb-6">
              <div>
                <h3 className="text-lg font-semibold mb-2">5.1 Cookies técnicas o funcionales</h3>
                <p className="text-muted-foreground">
                  Algunas cookies aseguran que ciertas partes de la web funcionen correctamente y que tus preferencias de usuario sigan recordándose. Al colocar cookies funcionales, te facilitamos la visita a nuestra web. De esta manera, no necesitas introducir repetidamente la misma información cuando visitas nuestra web y, por ejemplo, los artículos permanecen en tu cesta de la compra hasta que hayas pagado. Podemos colocar estas cookies sin tu consentimiento.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">5.2 Cookies de estadísticas</h3>
                <p className="text-muted-foreground">
                  Utilizamos cookies estadísticas para optimizar la experiencia de la web para nuestros usuarios. Con estas cookies estadísticas obtenemos información sobre el uso de nuestra web. Te pedimos tu permiso para colocar cookies de estadísticas.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">5.3 Cookies de marketing/seguimiento</h3>
                <p className="text-muted-foreground">
                  Las cookies de marketing/seguimiento son cookies, o cualquier otra forma de almacenamiento local, usadas para crear perfiles de usuario para mostrar publicidad o para hacer el seguimiento del usuario en esta web o en varias webs con fines de marketing similares.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">5.4 Redes sociales</h3>
                <p className="text-muted-foreground mb-4">
                  En nuestra web hemos incluido contenido de Facebook y WhatsApp para promover páginas web (p.ej.: «Me gusta», «Pinear») o compartir (p.ej.: «tuitear») en redes sociales como Facebook y WhatsApp. Este contenido está incrustado con código derivado de Facebook y WhatsApp y guarda cookies. Este contenido podría procesar cierta información para anuncios personalizados.
                </p>
                <p className="text-muted-foreground">
                  Por favor lea la política de privacidad de estas redes sociales (que puede cambiar frecuentemente) para saber que hacen con sus datos (personales) que procesan usando estas cookies. Los datos que reciben son anonimizados lo máximo posible. Facebook y WhatsApp están ubicados en los Estados Unidos.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">6. Cookies usadas</h2>
            <div className="space-y-3">
              <div className="bg-muted/30 p-4 rounded-lg">
                <h3 className="font-semibold mb-1">Google Fonts</h3>
                <p className="text-sm text-muted-foreground">Marketing/Seguimiento</p>
              </div>
              <div className="bg-muted/30 p-4 rounded-lg">
                <h3 className="font-semibold mb-1">Google reCAPTCHA</h3>
                <p className="text-sm text-muted-foreground">Marketing/Seguimiento</p>
              </div>
              <div className="bg-muted/30 p-4 rounded-lg">
                <h3 className="font-semibold mb-1">Google Analytics</h3>
                <p className="text-sm text-muted-foreground">Estadísticas (anónimas)</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">7. Consentimiento</h2>
            <p className="text-muted-foreground mb-4">
              Cuando visites nuestra web por primera vez, te mostraremos una ventana emergente con una explicación sobre las cookies. Tan pronto como hagas clic en «Guardar preferencias», aceptas que usemos las categorías de cookies y plugins que has seleccionado en la ventana emergente, tal y como se describe en esta política de cookies. Puedes desactivar el uso de cookies a través de tu navegador, pero, por favor, ten en cuenta que nuestra web puede dejar de funcionar correctamente.
            </p>
            <div className="bg-muted/30 p-4 rounded-lg">
              <h3 className="text-sm font-semibold mb-3">7.1 Gestiona tus ajustes de consentimiento</h3>
              <ul className="list-none space-y-2 text-sm text-muted-foreground">
                <li><strong>Funcional:</strong> Siempre activo</li>
                <li><strong>Preferencias:</strong> Personalizable</li>
                <li><strong>Estadísticas:</strong> Personalizable</li>
                <li><strong>Marketing:</strong> Personalizable</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">8. Activación/desactivación y borrado de cookies</h2>
            <p className="text-muted-foreground mb-4">
              Puedes utilizar tu navegador de Internet para eliminar las cookies de forma automática o manual. También puedes especificar que ciertas cookies no pueden ser colocadas. Otra opción es cambiar los ajustes de tu navegador de Internet para que recibas un mensaje cada vez que se coloca una cookie. Para obtener más información sobre estas opciones, consulta las instrucciones de la sección «Ayuda» de tu navegador.
            </p>
            <p className="text-muted-foreground mb-4">
              Ten en cuenta que nuestra web puede no funcionar correctamente si todas las cookies están desactivadas. Si borras las cookies de tu navegador, se volverán a colocar después de tu consentimiento cuando vuelvas a visitar nuestras webs.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">9. Tus derechos con respecto a los datos personales</h2>
            <p className="text-muted-foreground mb-4">
              Tienes los siguientes derechos con respecto a tus datos personales:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>Tiene derecho a saber por qué se necesitan tus datos personales, qué sucederá con ellos y durante cuánto tiempo se conservarán.</li>
              <li>Derecho de acceso: tienes derecho a acceder a tus datos personales que conocemos.</li>
              <li>Derecho de rectificación: tienes derecho a completar, rectificar, borrar o bloquear tus datos personales cuando lo desees.</li>
              <li>Si nos das tu consentimiento para procesar tus datos, tienes derecho a revocar dicho consentimiento y a que se eliminen tus datos personales.</li>
              <li>Derecho de cesión de tus datos: tienes derecho a solicitar todos tus datos personales al responsable del tratamiento y a transferirlos íntegramente a otro responsable del tratamiento.</li>
              <li>Derecho de oposición: puedes oponerte al tratamiento de tus datos. Nosotros cumplimos con esto, a menos que existan motivos justificados para el procesamiento.</li>
            </ul>
            <p className="text-muted-foreground mt-4">
              Para ejercer estos derechos, por favor, contacta con nosotros. Por favor, consulta los detalles de contacto en la parte inferior de esta política de cookies. Si tienes alguna queja sobre cómo gestionamos tus datos, nos gustaría que nos la hicieras saber, pero también tienes derecho a enviar una queja a la autoridad supervisora (la autoridad de protección de datos).
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">10. Datos de contacto</h2>
            <p className="text-muted-foreground mb-4">
              Para preguntas y/o comentarios sobre nuestra política de cookies y esta declaración, por favor, contacta con nosotros usando los siguientes datos de contacto:
            </p>
            <ul className="list-none pl-0 text-muted-foreground space-y-2">
              <li><strong>José Sabater Delgado</strong></li>
              <li><strong>DNI:</strong> 48413424B</li>
              <li><strong>Web:</strong> <a href="https://optimizalo.app" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">https://optimizalo.app</a></li>
              <li><strong>Correo electrónico:</strong> <a href="mailto:contacto@optimizalo.app" className="text-primary hover:underline">contacto@optimizalo.app</a></li>
            </ul>
            <p className="text-muted-foreground mt-4">
              Para más información sobre cómo manejamos tus datos personales, consulta nuestra{" "}
              <Link to="/politica-privacidad" className="text-primary hover:underline">
                Política de Privacidad
              </Link>.
            </p>
            <p className="text-sm text-muted-foreground mt-6">
              Esta política de cookies se ha sincronizado con cookiedatabase.org el 8 de julio de 2022.
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

export default CookiesPolicyPage;