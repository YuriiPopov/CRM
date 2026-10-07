import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { AppRoutes } from './AppRoutes'
import { useClientUpdateRequired } from './api/clientUpdate'
import { UpdateRequiredScreen } from './components/UpdateRequiredScreen'
import './App.css'

function App() {
  const updateRequired = useClientUpdateRequired()

  if (updateRequired) {
    return <UpdateRequiredScreen />
  }

  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
