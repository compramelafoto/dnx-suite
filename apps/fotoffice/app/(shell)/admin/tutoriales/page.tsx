import { PageHeader } from "@/components/page-header";
import { rutaDelCurso } from "@/lib/tutoriales/curso";
import { CURSOS_TUTORIALES } from "@/lib/tutoriales/cursos";
import { videosDelCurso } from "@/lib/tutoriales/videos";
import { FormularioCurso } from "./formulario-curso";

export const dynamic = "force-dynamic";

/** Los links de YouTube de cada clase de /tutoriales. El acceso lo controla el layout de /admin. */
export default async function AdminTutorialesPage() {
  const cursos = await Promise.all(
    CURSOS_TUTORIALES.map(async (curso) => ({ curso, videos: await videosDelCurso(curso) })),
  );

  return (
    <div className="space-y-8">
      <PageHeader
        title="Tutoriales en video"
        description="Los cursos que se ven en /tutoriales. Cada clase muestra el video cuando tiene su link de YouTube."
      />
      {cursos.map(({ curso, videos }) => (
        <FormularioCurso
          key={curso.slug}
          slug={curso.slug}
          titulo={curso.titulo}
          ruta={rutaDelCurso(curso)}
          bloques={curso.bloques}
          videos={videos}
        />
      ))}
    </div>
  );
}
