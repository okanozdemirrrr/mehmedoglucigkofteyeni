import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'
import Sidebar from './Sidebar'

export default function Layout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)

  function toggleSidebar() {
    setIsSidebarOpen((open) => !open)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar onToggleSidebar={toggleSidebar} />

      <div className="flex flex-1 min-h-0">
        <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

        <main className="flex-1 min-w-0 overflow-auto">
          <div className="max-w-7xl mx-auto px-4 py-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
