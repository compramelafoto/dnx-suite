import type { Region } from "./tipos";

/**
 * Ciudades de Argentina por región y provincia: capitales y ciudades de más de ~20.000 habitantes
 * (cifras aproximadas del censo 2022, de memoria: ante la duda se prefirió no incluir).
 * `grande: true` sólo para capitales provinciales, CABA, Rosario y los partidos del Gran Buenos Aires
 * con más de 300.000 habitantes: esas piden más páginas de resultados a Google Places.
 */
export type CiudadBuscable = { nombre: string; grande: boolean };
export type ProvinciaBuscable = { provincia: string; ciudades: CiudadBuscable[] };

const g = (nombre: string): CiudadBuscable => ({ nombre, grande: true });
const c = (...nombres: string[]): CiudadBuscable[] => nombres.map((nombre) => ({ nombre, grande: false }));

export const CIUDADES: Record<Region, ProvinciaBuscable[]> = {
  CENTRO: [
    {
      provincia: "Santa Fe",
      ciudades: [
        g("Santa Fe"), g("Rosario"),
        // Gran Rosario
        ...c("Funes", "Roldán", "Villa Gobernador Gálvez", "Granadero Baigorria", "Pérez", "San Lorenzo"),
        ...c("Rafaela", "Reconquista", "Venado Tuerto", "Esperanza", "Santo Tomé", "Casilda", "Cañada de Gómez",
          "Sunchales", "Gálvez", "Villa Constitución", "San Justo", "Las Parejas", "Firmat", "Rufino", "Arroyo Seco",
          "San Jorge", "Carcarañá", "Avellaneda"),
      ],
    },
    {
      provincia: "Córdoba",
      ciudades: [
        g("Córdoba"),
        ...c("Río Cuarto", "Villa María", "San Francisco", "Villa Carlos Paz", "Alta Gracia", "Río Tercero", "Bell Ville",
          "Jesús María", "Colonia Caroya", "Cosquín", "Marcos Juárez", "Villa Allende", "La Calera", "Río Ceballos",
          "Unquillo", "Cruz del Eje", "Villa Dolores", "Morteros", "Laboulaye", "Oncativo", "Arroyito", "Villa Nueva",
          "Río Segundo", "Deán Funes"),
      ],
    },
    {
      provincia: "Entre Ríos",
      ciudades: [
        g("Paraná"),
        ...c("Concordia", "Gualeguaychú", "Concepción del Uruguay", "Gualeguay", "Chajarí", "Victoria", "Villaguay",
          "Crespo", "La Paz", "Federación", "Colón", "Diamante", "Nogoyá", "San José"),
      ],
    },
  ],
  BUENOS_AIRES_AMBA: [
    {
      provincia: "Ciudad Autónoma de Buenos Aires",
      ciudades: [g("Ciudad Autónoma de Buenos Aires")],
    },
    {
      provincia: "Buenos Aires",
      ciudades: [
        g("La Plata"),
        // Gran Buenos Aires (partidos): grandes los de más de 300.000 habitantes
        g("La Matanza"), g("Lomas de Zamora"), g("Quilmes"), g("Lanús"), g("Almirante Brown"), g("Merlo"), g("Moreno"),
        g("Florencio Varela"), g("Avellaneda"), g("General San Martín"), g("Tres de Febrero"), g("Esteban Echeverría"),
        g("Berazategui"), g("Tigre"), g("Morón"), g("Malvinas Argentinas"), g("San Miguel"), g("Pilar"),
        ...c("Vicente López", "San Isidro", "San Fernando", "José C. Paz", "Hurlingham", "Ituzaingó", "Escobar",
          "Ezeiza", "San Vicente", "Marcos Paz", "General Rodríguez", "Cañuelas", "Berisso", "Ensenada"),
        // Interior de la provincia
        ...c("Mar del Plata", "Bahía Blanca", "Tandil", "Olavarría", "Pergamino", "Junín", "Necochea", "Azul", "Zárate",
          "Campana", "San Nicolás de los Arroyos", "Luján", "San Pedro", "Chivilcoy", "Mercedes", "Tres Arroyos",
          "Balcarce", "Chascomús", "Trenque Lauquen", "Nueve de Julio", "Bragado", "Lincoln", "Villa Gesell", "Pinamar",
          "Dolores", "Saladillo", "Coronel Suárez", "Pehuajó", "Bolívar", "Chacabuco", "Punta Alta", "Las Flores",
          "Lobos", "Miramar", "Carmen de Patagones"),
      ],
    },
  ],
  CUYO: [
    {
      provincia: "Mendoza",
      ciudades: [
        g("Mendoza"),
        ...c("Godoy Cruz", "Guaymallén", "Las Heras", "Maipú", "Luján de Cuyo", "San Rafael", "San Martín", "Rivadavia",
          "Tunuyán", "General Alvear", "Malargüe"),
      ],
    },
    {
      provincia: "San Juan",
      ciudades: [g("San Juan"), ...c("Rawson", "Rivadavia", "Chimbas", "Santa Lucía", "Pocito", "Caucete", "Albardón")],
    },
    { provincia: "San Luis", ciudades: [g("San Luis"), ...c("Villa Mercedes", "Juana Koslay")] },
    { provincia: "La Rioja", ciudades: [g("La Rioja"), ...c("Chilecito")] },
  ],
  NOA: [
    {
      provincia: "Jujuy",
      ciudades: [g("San Salvador de Jujuy"), ...c("Palpalá", "San Pedro de Jujuy", "Libertador General San Martín", "Perico")],
    },
    {
      provincia: "Salta",
      ciudades: [g("Salta"), ...c("San Ramón de la Nueva Orán", "Tartagal", "General Güemes", "Metán",
        "Rosario de la Frontera", "Embarcación", "Pichanal")],
    },
    {
      provincia: "Tucumán",
      ciudades: [g("San Miguel de Tucumán"), ...c("Yerba Buena", "Tafí Viejo", "Banda del Río Salí", "Concepción",
        "Aguilares", "Monteros", "Famaillá", "Alderetes", "Las Talitas", "Lules")],
    },
    { provincia: "Catamarca", ciudades: [g("San Fernando del Valle de Catamarca"), ...c("Valle Viejo")] },
    {
      provincia: "Santiago del Estero",
      ciudades: [g("Santiago del Estero"), ...c("La Banda", "Termas de Río Hondo", "Frías", "Añatuya")],
    },
  ],
  NEA: [
    {
      provincia: "Misiones",
      ciudades: [g("Posadas"), ...c("Oberá", "Eldorado", "Puerto Iguazú", "Apóstoles", "Leandro N. Alem", "Garupá",
        "Jardín América")],
    },
    {
      provincia: "Corrientes",
      ciudades: [g("Corrientes"), ...c("Goya", "Paso de los Libres", "Curuzú Cuatiá", "Mercedes", "Esquina", "Santo Tomé",
        "Ituzaingó", "Monte Caseros")],
    },
    {
      provincia: "Chaco",
      ciudades: [g("Resistencia"), ...c("Presidencia Roque Sáenz Peña", "Villa Ángela", "Barranqueras", "Fontana",
        "Charata")],
    },
    { provincia: "Formosa", ciudades: [g("Formosa"), ...c("Clorinda")] },
  ],
  PATAGONIA: [
    { provincia: "La Pampa", ciudades: [g("Santa Rosa"), ...c("General Pico")] },
    {
      provincia: "Neuquén",
      ciudades: [g("Neuquén"), ...c("Cutral Có", "Plottier", "Centenario", "Zapala", "San Martín de los Andes")],
    },
    {
      provincia: "Río Negro",
      ciudades: [g("Viedma"), ...c("San Carlos de Bariloche", "General Roca", "Cipolletti", "Villa Regina", "Allen",
        "Cinco Saltos", "El Bolsón")],
    },
    {
      provincia: "Chubut",
      ciudades: [g("Rawson"), ...c("Comodoro Rivadavia", "Trelew", "Puerto Madryn", "Esquel")],
    },
    {
      provincia: "Santa Cruz",
      ciudades: [g("Río Gallegos"), ...c("Caleta Olivia", "Pico Truncado", "El Calafate")],
    },
    { provincia: "Tierra del Fuego", ciudades: [g("Ushuaia"), ...c("Río Grande")] },
  ],
};
