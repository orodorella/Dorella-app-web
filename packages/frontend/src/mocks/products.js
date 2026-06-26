import img7 from '../imagenes/7_07239255-b0be-4b2e-922e-dc977f298d9b.webp'
import img12 from '../imagenes/12.webp'
import img13a from '../imagenes/13_224003dc-9769-4088-89dd-b061cd319008.webp'
import img13b from '../imagenes/13_f2814477-080a-4b26-a3b6-9b5a0e73d778.webp'
import img15 from '../imagenes/15_1982e0a9-c9a2-41c3-baad-bb9f3ae989a1.webp'
import img17 from '../imagenes/17_78ecf0cf-229e-40e7-92c8-d08d45943d3c.webp'
import img21 from '../imagenes/21.webp'
import img24 from '../imagenes/24_2acaf876-f489-4202-a0ee-fb489d1dbf69.webp'
import img25 from '../imagenes/25_ab9002d3-51e6-4bac-bc68-7450750b0d62.webp'
import img26 from '../imagenes/26.webp'
import img32 from '../imagenes/32_6ae896aa-b3e7-4eb2-92ee-16b17dffbc43.webp'
import img39 from '../imagenes/39.webp'
import img41 from '../imagenes/41.webp'
import img42 from '../imagenes/42_86693642-e7e8-4441-abd4-af9635b013f2.webp'
import img45 from '../imagenes/45.webp'
import img46 from '../imagenes/46.webp'
import img48 from '../imagenes/48.webp'
import img49 from '../imagenes/49.webp'
import img50 from '../imagenes/50.webp'
import img52 from '../imagenes/52.webp'
import imgCandonga from '../imagenes/aretes-candonga-balin-circon-centro-17mm-6449663.webp'
import imgBisel from '../imagenes/aretes-candonga-bisel-20mm-2112183.webp'
import imgChispa from '../imagenes/aretes-topo-lujo-chispa-4mm-blanco-6907592.webp'
import imgRolex from '../imagenes/aretes-topo-lujo-cuadrado-rolex-8504809.webp'
import imgGucci from '../imagenes/aretes-topo-lujo-gucci-lisos-1633948.webp'
import imgTrebol from '../imagenes/aretes-topo-lujo-trebol-azul-pequeno-1429693.webp'
import imgDije from '../imagenes/dije-avion-liso-3105088.webp'
import img2 from '../imagenes/2_38f9ed07-3b58-49ea-ae45-978ef94c489d.webp'
import imgManilla from '../imagenes/manilla-guadalupe-diamantada-8475110.webp'
import imgUpsell2 from '../imagenes/upssel2.webp'
import imgUpsell3 from '../imagenes/upsell3.webp'

const categories = ['Aretes', 'Cadenas', 'Anillos', 'Pulseras', 'Dijes', 'Conjuntos', 'Tobilleras', 'Broches']

function slugify(str) {
  return str.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

const products = [
  { id: 1, ref: 'AR-001', nombre: 'Aretes Gota Imperial', categoria: 'Aretes', precioPublico: 48900, stock: 120, imagen: imgCandonga, material: 'Oro laminado 18k', descripcion: 'Aretes tipo candonga con balín y circón central de 17mm. Diseño clásico que combina elegancia y brillo para uso diario o eventos especiales.' },
  { id: 2, ref: 'AR-002', nombre: 'Aretes Argolla Milán', categoria: 'Aretes', precioPublico: 35900, stock: 200, imagen: imgBisel, material: 'Oro laminado 18k', descripcion: 'Argollas tipo candonga con bisel de 20mm. Acabado pulido que refleja la luz con sofisticación.' },
  { id: 3, ref: 'AR-003', nombre: 'Aretes Candongas Florencia', categoria: 'Aretes', precioPublico: 52900, stock: 85, imagen: img48, material: 'Oro laminado 18k', descripcion: 'Candongas estilo Love con diseño grabado. Inspiradas en la joyería italiana contemporánea.' },
  { id: 4, ref: 'AR-004', nombre: 'Aretes Trepador Viena', categoria: 'Aretes', precioPublico: 42900, stock: 150, imagen: imgChispa, material: 'Oro laminado 18k con circón', descripcion: 'Topos tipo chispa de 4mm con circón blanco brillante. Minimalismo premium para el día a día.' },
  { id: 5, ref: 'AR-005', nombre: 'Aretes Botón Perla Venecia', categoria: 'Aretes', precioPublico: 28900, stock: 300, imagen: imgGucci, material: 'Oro laminado 18k', descripcion: 'Topos estilo Gucci lisos con acabado espejo. La pieza esencial de toda colección.' },
  { id: 6, ref: 'CD-001', nombre: 'Cadena Eslabón Cubano 50cm', categoria: 'Cadenas', precioPublico: 89900, stock: 60, imagen: img21, material: 'Oro laminado 18k — 30 micras', descripcion: 'Cadena eslabón cubano de 50cm con sello 18k. Presencia y peso visual imponente.' },
  { id: 7, ref: 'CD-002', nombre: 'Cadena Figaro Clásica 45cm', categoria: 'Cadenas', precioPublico: 75900, stock: 90, imagen: img12, material: 'Oro laminado 18k — 30 micras', descripcion: 'Cadena Figaro clásica de 45cm. Eslabones alternados que crean un patrón atemporal.' },
  { id: 8, ref: 'CD-003', nombre: 'Cadena Serpiente Delicada 40cm', categoria: 'Cadenas', precioPublico: 62900, stock: 110, imagen: img7, material: 'Oro laminado 18k', descripcion: 'Cadena tipo serpiente flexible de 40cm. Superficie lisa que captura la luz en cada movimiento.' },
  { id: 9, ref: 'CD-004', nombre: 'Cadena Rolo Gruesa 55cm', categoria: 'Cadenas', precioPublico: 98900, stock: 45, imagen: img17, material: 'Oro laminado 18k — 30 micras', descripcion: 'Cadena Rolo gruesa de 55cm con eslabones redondos. Ideal para dijes o como statement piece.' },
  { id: 10, ref: 'CD-005', nombre: 'Cadena Veneciana 42cm', categoria: 'Cadenas', precioPublico: 54900, stock: 130, imagen: img15, material: 'Oro laminado 18k', descripcion: 'Cadena veneciana de 42cm. Tejido box que aporta estructura y elegancia a cualquier look.' },
  { id: 11, ref: 'AN-001', nombre: 'Anillo Solitario Marquesa', categoria: 'Anillos', precioPublico: 68900, stock: 75, imagen: img39, material: 'Oro laminado 18k con circones', descripcion: 'Anillo solitario con piedra marquesa central. Brillo intenso con montura delicada.' },
  { id: 12, ref: 'AN-002', nombre: 'Anillo Cintillo Circones', categoria: 'Anillos', precioPublico: 45900, stock: 160, imagen: img41, material: 'Oro laminado 18k con circones', descripcion: 'Cintillo completo con circones engastados. Versátil para usar solo o en combinación.' },
  { id: 13, ref: 'AN-003', nombre: 'Anillo Corona Imperial', categoria: 'Anillos', precioPublico: 79900, stock: 55, imagen: img42, material: 'Oro laminado 18k con circones', descripcion: 'Anillo tipo corona con micropavé de circones. Diseño real para manos que buscan protagonismo.' },
  { id: 14, ref: 'AN-004', nombre: 'Anillo Infinito Pavé', categoria: 'Anillos', precioPublico: 52900, stock: 100, imagen: img13a, material: 'Oro laminado 18k', descripcion: 'Anillo con símbolo de infinito y detalle pavé. Significado eterno en oro laminado.' },
  { id: 15, ref: 'AN-005', nombre: 'Anillo Serpiente Dorada', categoria: 'Anillos', precioPublico: 62900, stock: 80, imagen: img13b, material: 'Oro laminado 18k', descripcion: 'Anillo serpiente con cuerpo flexible y ojos de circón. Pieza statement con personalidad.' },
  { id: 16, ref: 'PU-001', nombre: 'Pulsera Tennis Brillantes', categoria: 'Pulseras', precioPublico: 95900, stock: 40, imagen: img24, material: 'Oro laminado 18k con circones', descripcion: 'Pulsera tennis con circones engastados en toda su extensión. Brillo de 360 grados.' },
  { id: 17, ref: 'PU-002', nombre: 'Pulsera Eslabón Grueso', categoria: 'Pulseras', precioPublico: 72900, stock: 70, imagen: img25, material: 'Oro laminado 18k — 30 micras', descripcion: 'Pulsera de eslabón grueso con acabado pulido. Presencia audaz y contemporánea.' },
  { id: 18, ref: 'PU-003', nombre: 'Pulsera Charm Corazones', categoria: 'Pulseras', precioPublico: 58900, stock: 95, imagen: img32, material: 'Oro laminado 18k', descripcion: 'Pulsera con charms de corazones colgantes. Romántica, delicada y femenina.' },
  { id: 19, ref: 'PU-004', nombre: 'Pulsera Rígida Ovalada', categoria: 'Pulseras', precioPublico: 84900, stock: 50, imagen: img46, material: 'Oro laminado 18k — 30 micras', descripcion: 'Brazalete rígido ovalado con cierre de seguridad. Silueta limpia y moderna.' },
  { id: 20, ref: 'PU-005', nombre: 'Pulsera Cadena Doble', categoria: 'Pulseras', precioPublico: 48900, stock: 140, imagen: img49, material: 'Oro laminado 18k', descripcion: 'Pulsera de doble cadena con extensión ajustable. Layering perfecto en una sola pieza.' },
  { id: 21, ref: 'DJ-001', nombre: 'Dije Corazón Locket', categoria: 'Dijes', precioPublico: 42900, stock: 180, imagen: imgDije, material: 'Oro laminado 18k', descripcion: 'Dije tipo locket con forma de corazón. Guarda una foto o recuerdo dentro.' },
  { id: 22, ref: 'DJ-002', nombre: 'Dije Cruz Bizantina', categoria: 'Dijes', precioPublico: 38900, stock: 200, imagen: img52, material: 'Oro laminado 18k', descripcion: 'Dije de cruz con detalles bizantinos. Pieza de fe con acabado artesanal.' },
  { id: 23, ref: 'DJ-003', nombre: 'Dije Inicial Cursiva', categoria: 'Dijes', precioPublico: 32900, stock: 250, imagen: img45, material: 'Oro laminado 18k', descripcion: 'Dije con inicial en tipografía cursiva. Personalización elegante para regalo.' },
  { id: 24, ref: 'DJ-004', nombre: 'Dije Medalla Virgen', categoria: 'Dijes', precioPublico: 45900, stock: 120, imagen: img2, material: 'Oro laminado 18k', descripcion: 'Medalla de la Virgen con borde diamantado. Devoción y protección en oro.' },
  { id: 25, ref: 'DJ-005', nombre: 'Dije Mariposa Circones', categoria: 'Dijes', precioPublico: 35900, stock: 170, imagen: imgUpsell2, material: 'Oro laminado 18k con circones', descripcion: 'Dije de mariposa con alas de micropavé. Símbolo de transformación con destellos.' },
  { id: 26, ref: 'CJ-001', nombre: 'Conjunto Lluvia de Estrellas', categoria: 'Conjuntos', precioPublico: 142900, stock: 30, imagen: imgTrebol, material: 'Oro laminado 18k con circones', descripcion: 'Conjunto de aretes y collar con diseño de estrellas y circones. Coordinación perfecta.' },
  { id: 27, ref: 'CJ-002', nombre: 'Conjunto Perlas del Pacífico', categoria: 'Conjuntos', precioPublico: 128900, stock: 25, imagen: imgRolex, material: 'Oro laminado 18k', descripcion: 'Conjunto estilo clásico con acabado tipo Rolex. Aretes y pulsera coordinados.' },
  { id: 28, ref: 'CJ-003', nombre: 'Conjunto Clásico Dorado', categoria: 'Conjuntos', precioPublico: 155900, stock: 20, imagen: img50, material: 'Oro laminado 18k — 30 micras', descripcion: 'Conjunto premium con cadena y aretes a juego. Todo el brillo de 30 micras.' },
  { id: 29, ref: 'CJ-004', nombre: 'Conjunto Rosa de los Vientos', categoria: 'Conjuntos', precioPublico: 168900, stock: 15, imagen: imgUpsell3, material: 'Oro laminado 18k con circones', descripcion: 'Conjunto inspirado en la rosa de los vientos. Collar y aretes con brújula de circones.' },
  { id: 30, ref: 'CJ-005', nombre: 'Conjunto Elegance Noir', categoria: 'Conjuntos', precioPublico: 189900, stock: 18, imagen: null, material: 'Oro laminado 18k', descripcion: 'Conjunto de gala con piedras negras tipo ónix. Sofisticación para eventos especiales.' },
  { id: 31, ref: 'TB-001', nombre: 'Tobillera Eslabón Fino', categoria: 'Tobilleras', precioPublico: 32900, stock: 160, imagen: imgManilla, material: 'Oro laminado 18k', descripcion: 'Tobillera de eslabón fino con extensión ajustable. Brillo sutil para los tobillos.' },
  { id: 32, ref: 'TB-002', nombre: 'Tobillera Charm Estrellas', categoria: 'Tobilleras', precioPublico: 38900, stock: 130, imagen: null, material: 'Oro laminado 18k', descripcion: 'Tobillera con charms de estrellas colgantes. Movimiento y brillo con cada paso.' },
  { id: 33, ref: 'TB-003', nombre: 'Tobillera Doble Cadena', categoria: 'Tobilleras', precioPublico: 42900, stock: 100, imagen: null, material: 'Oro laminado 18k', descripcion: 'Tobillera de doble cadena con cierre ajustable. Layering para los pies.' },
  { id: 34, ref: 'BR-001', nombre: 'Broche Flor de Lis', categoria: 'Broches', precioPublico: 55900, stock: 60, imagen: null, material: 'Oro laminado 18k', descripcion: 'Broche tipo flor de lis con acabado pulido. Acento heráldico para blazers y solapas.' },
  { id: 35, ref: 'BR-002', nombre: 'Broche Mariposa Elegante', categoria: 'Broches', precioPublico: 48900, stock: 75, imagen: null, material: 'Oro laminado 18k con circones', descripcion: 'Broche de mariposa con alas articuladas y circones. Movimiento real al caminar.' },
  { id: 36, ref: 'AR-006', nombre: 'Aretes Cascada Brillante', categoria: 'Aretes', precioPublico: 65900, stock: 70, imagen: img26, material: 'Oro laminado 18k con amatista', descripcion: 'Aretes trébol con piedras de amatista en forma de corazón. Color y personalidad únicos.' },
  { id: 37, ref: 'CD-006', nombre: 'Cadena Choker Ajustable', categoria: 'Cadenas', precioPublico: 45900, stock: 100, imagen: null, material: 'Oro laminado 18k', descripcion: 'Choker de cadena ajustable de 35-40cm. Tendencia contemporánea en oro laminado.' },
  { id: 38, ref: 'AN-006', nombre: 'Anillo Doble Banda Cruzada', categoria: 'Anillos', precioPublico: 55900, stock: 90, imagen: null, material: 'Oro laminado 18k', descripcion: 'Anillo de doble banda cruzada. Diseño arquitectónico que juega con la geometría.' },
  { id: 39, ref: 'PU-006', nombre: 'Pulsera Malla Milanesa', categoria: 'Pulseras', precioPublico: 68900, stock: 55, imagen: null, material: 'Oro laminado 18k', descripcion: 'Pulsera de malla milanesa con broche magnético. Textura refinada estilo relojería.' },
  { id: 40, ref: 'DJ-006', nombre: 'Dije Ojo Turco Protección', categoria: 'Dijes', precioPublico: 29900, stock: 220, imagen: null, material: 'Oro laminado 18k con esmalte', descripcion: 'Dije ojo turco con esmalte azul y blanco. Protección con estilo y color.' },
].map((p) => ({ ...p, slug: slugify(p.nombre) }))

export { products, categories }
