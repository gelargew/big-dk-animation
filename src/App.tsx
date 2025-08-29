import './App.css'
import 'lenis/dist/lenis.css'
import { Gallery2 } from './gallery2/Gallery2'
import { ReactLenis } from 'lenis/react'

function App() {
    return (
        <ReactLenis root options={{
            easing: (t) => 1 - Math.pow(1 - t, 3) // expo.out easing
        }}>
            <main style={{ width: '100vw' }}>
                {/* <Gallery /> */}
                <Gallery2 />
            </main>
        </ReactLenis>
    )
}

export default App
