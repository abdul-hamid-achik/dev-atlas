export default function HomePage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-4">Dev Atlas 🗺️</h1>
      <p className="text-xl mb-8"><strong>Mapea tu conocimiento de desarrollo como nunca antes</strong></p>
      
      <p className="mb-6">
        Dev Atlas es una solución completa para crear y gestionar knowledge graphs específicamente diseñados para desarrolladores. 
        Combina un potente servidor MCP (Model Context Protocol) con una extensión elegante para VS Code/Cursor.
      </p>

      <div className="mt-16 mb-20 text-center">
        <div className="text-6xl mb-6">🧠💻🌐</div>
        <h2 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          Conecta Ideas. Mapea Código. Acelera Desarrollo.
        </h2>
      </div>

      <h2 className="text-2xl font-bold mb-4">¿Qué es Dev Atlas?</h2>
      <p className="mb-6">
        Dev Atlas transforma la manera en que organizas y navegas el conocimiento de desarrollo. 
        No más información dispersa en notas, documentos o comentarios perdidos en el código.
      </p>

      <div className="p-4 border-l-4 border-blue-500 bg-blue-50 my-8">
        <strong>💡 Knowledge Graph:</strong> Una representación visual y estructurada de conceptos, relaciones y dependencias en tu ecosistema de desarrollo.
      </div>

      <h2 className="text-2xl font-bold mb-6">Características Principales</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        <div className="border rounded-lg p-6 hover:shadow-md transition-shadow">
          <div className="text-2xl mb-2">🔗</div>
          <h3 className="text-xl font-semibold mb-2">Servidor MCP Potente</h3>
          <p>Gestiona knowledge graphs en SQLite con operaciones CRUD, búsqueda avanzada y traversal de grafos</p>
        </div>
        <div className="border rounded-lg p-6 hover:shadow-md transition-shadow">
          <div className="text-2xl mb-2">🎨</div>
          <h3 className="text-xl font-semibold mb-2">Extensión VS Code/Cursor</h3>
          <p>Interfaz visual elegante con comandos integrados y vista en el explorador</p>
        </div>
        <div className="border rounded-lg p-6 hover:shadow-md transition-shadow">
          <div className="text-2xl mb-2">⚡</div>
          <h3 className="text-xl font-semibold mb-2">Alto Rendimiento</h3>
          <p>Built with TypeScript, Drizzle ORM, y arquitectura moderna de monorepo</p>
        </div>
        <div className="border rounded-lg p-6 hover:shadow-md transition-shadow">
          <div className="text-2xl mb-2">🔍</div>
          <h3 className="text-xl font-semibold mb-2">Búsqueda Inteligente</h3>
          <p>Encuentra conexiones y patrones que no habías notado antes</p>
        </div>
      </div>

      <div className="mt-20 p-8 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-blue-200">
        <div className="text-center">
          <h3 className="text-2xl font-bold mb-4">¿Listo para mapear tu conocimiento?</h3>
          <p className="text-lg text-gray-600 mb-6">
            Únete a la revolución del knowledge management para desarrolladores
          </p>
          <div className="flex gap-4 justify-center">
            <a 
              href="/docs/getting-started" 
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              Comenzar Ahora →
            </a>
            <a 
              href="https://github.com/abdul-hamid-achik/dev-atlas" 
              className="px-6 py-3 border border-gray-300 rounded-lg font-semibold hover:border-gray-400 transition-colors"
            >
              Ver en GitHub
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}