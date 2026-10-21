import { useEffect, useState } from 'react'

function App() {
  const [backend, setBackend] = useState('checking…')

  useEffect(() => {
    fetch('/api/health')
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((data) => setBackend(`Backend: ${data.status}`))
      .catch(() => setBackend('backend unreachable'))
  }, [])

  return (
    <main>
      <h1>Fine Print</h1>
      <p>{backend}</p>
    </main>
  )
}

export default App
