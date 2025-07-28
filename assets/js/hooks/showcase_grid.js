const ShowcaseGrid = {
  mounted() {
    console.log('ShowcaseGrid hook mounted')
    this.initThreeGrid()
  },

  initThreeGrid() {
    import('three').then((THREE) => {
      const canvas = document.getElementById('showcase-canvas')
      const container = this.el
      
      // Renderer
      const renderer = new THREE.WebGLRenderer({ 
        canvas: canvas,
        antialias: true 
      })
      renderer.setSize(container.clientWidth, container.clientHeight)
      renderer.setPixelRatio(window.devicePixelRatio)
      
      // Grid setup
      const gridCols = 8
      const gridRows = 4
      const totalCubes = 32
      const scenes = []
      const cameras = []
      const cubes = []
      
      // Colors
      const colors = [
        "#FF0000", "#00FF00", "#0000FF", "#FFFF00", "#FF00FF", "#00FFFF",
        "#FF6600", "#6600FF", "#00FF66", "#FF0066", "#66FF00", "#0066FF",
        "#FF3333", "#33FF33", "#3333FF", "#FFFF33", "#FF33FF", "#33FFFF",
        "#FF9900", "#9900FF", "#00FF99", "#FF0099", "#99FF00", "#0099FF",
        "#FF6666", "#66FF66", "#6666FF", "#FFFF66", "#FF66FF", "#66FFFF",
        "#FFCC00", "#CC00FF"
      ]
      
      // Create scenes, cameras and cubes
      for (let i = 0; i < totalCubes; i++) {
        // Scene
        const scene = new THREE.Scene()
        scene.background = new THREE.Color(0x1a1a1a)
        scenes.push(scene)
        
        // Camera
        const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 10)
        camera.position.z = 3
        cameras.push(camera)
        
        // Cube
        const geometry = new THREE.BoxGeometry(1, 1, 1)
        const material = new THREE.MeshBasicMaterial({ 
          color: colors[i % colors.length] 
        })
        const cube = new THREE.Mesh(geometry, material)
        scene.add(cube)
        cubes.push({
          mesh: cube,
          rotationSpeedX: 0.005 + Math.random() * 0.01,
          rotationSpeedY: 0.005 + Math.random() * 0.01
        })
      }
      
      // Animation loop
      const animate = () => {
        requestAnimationFrame(animate)
        
        const width = container.clientWidth / gridCols
        const height = container.clientHeight / gridRows
        
        renderer.setScissorTest(true)
        
        for (let i = 0; i < totalCubes; i++) {
          const col = i % gridCols
          const row = Math.floor(i / gridCols)
          
          const x = col * width
          const y = (gridRows - row - 1) * height
          
          // Set viewport and scissor
          renderer.setViewport(x, y, width, height)
          renderer.setScissor(x, y, width, height)
          
          // Update camera aspect
          cameras[i].aspect = width / height
          cameras[i].updateProjectionMatrix()
          
          // Rotate cube
          cubes[i].mesh.rotation.x += cubes[i].rotationSpeedX
          cubes[i].mesh.rotation.y += cubes[i].rotationSpeedY
          
          // Render
          renderer.render(scenes[i], cameras[i])
        }
      }
      
      animate()
      
      // Handle resize
      window.addEventListener('resize', () => {
        renderer.setSize(container.clientWidth, container.clientHeight)
      })
    })
  }
}

export default ShowcaseGrid