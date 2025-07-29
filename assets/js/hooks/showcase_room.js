const ShowcaseRoom = {
  mounted() {
    console.log('ShowcaseRoom hook mounted')
    this.initThree()
    this.setupPhoenixEventHandlers()
  },
  
  setupPhoenixEventHandlers() {
    // Handle component creation confirmation from Phoenix
    this.handleEvent("component_created", (component) => {
      console.log("Component created confirmed by Phoenix:", component)
      // Update the object with Phoenix-assigned properties
      const object = this.objects.find(obj => obj.userData.id == component.id)
      if (object) {
        object.userData = {...object.userData, ...component}
        if (object.material && component.color) {
          object.material.color.set(component.color)
        }
      }
    })
    
    // Handle position updates from Phoenix
    this.handleEvent("update_component_position", ({id, position}) => {
      const object = this.objects.find(obj => obj.userData.id == id)
      if (object) {
        if (position) {
          object.position.set(position.x, position.y, position.z)
        }
        
        // Update selection helper if this is the selected object
        if (this.selectedObject && this.selectedObject.userData.id == id && this.selectionHelper) {
          const box = new this.THREE.Box3().setFromObject(object)
          this.selectionHelper.box = box
        }
      }
    })
    
    // Handle color updates from Phoenix
    this.handleEvent("update_component_color", ({id, color}) => {
      const object = this.objects.find(obj => obj.userData.id == id)
      if (object) {
        if (object.userData.type === 'mesh' && object.userData.solidMesh) {
          // For converted meshes, update the solid mesh color
          const solidMesh = object.userData.solidMesh
          if (solidMesh.material) {
            solidMesh.material.color.set(color)
          }
        } else if (object.userData.type === 'glb') {
          // For GLB models, update all mesh materials
          object.traverse((child) => {
            if (child.isMesh && child.material) {
              // Clone material to avoid affecting other instances
              if (!child.material.userData || !child.material.userData.isCloned) {
                child.material = child.material.clone()
                child.material.userData = { isCloned: true }
              }
              child.material.color.set(color)
            }
          })
          // Store the color for saving
          object.userData.color = color
        } else if (object.material) {
          // For basic shapes and parametric objects
          object.material.color.set(color)
        }
      }
    })
    
    // Handle scene state request for saving
    this.handleEvent("request_scene_state", () => {
      console.log("Scene state requested from Phoenix")
      const sceneState = this.getCompleteSceneState()
      console.log("Sending scene state:", sceneState)
      this.pushEvent("scene_state_ready", sceneState)
    })
    
    // Handle loading a saved scene
    this.handleEvent("load_scene", ({objects, scene_config, camera_state, lighting_config}) => {
      this.loadScene(objects, scene_config, camera_state, lighting_config)
    })
    
    // Handle scene export as GLB
    this.handleEvent("export_scene_as_glb", () => {
      console.log("Exporting scene as GLB")
      this.exportSceneAsGLB()
    })
    
    // Handle light toggling
    this.handleEvent("toggle_light", ({type, enabled}) => {
      console.log(`Toggling light ${type} to ${enabled}`)
      if (this.lights && this.lights[type]) {
        // For all lights, toggle visibility directly
        this.lights[type].visible = enabled
        console.log(`Light ${type} visibility set to ${enabled}`)
      }
    })
    
    // Handle rail light toggling
    this.handleEvent("toggle_rail_light", ({enabled}) => {
      console.log(`Toggling rail light to ${enabled}`)
      if (this.railLight && this.railLight.container) {
        this.railLight.container.visible = enabled
        this.railLight.visible = enabled
        console.log(`Rail light visibility set to ${enabled}`)
      }
    })
    
    // Handle exposure adjustment
    this.handleEvent("adjust_exposure", ({value}) => {
      if (this.renderer) {
        this.renderer.toneMappingExposure = parseFloat(value)
      }
    })
    
    // Handle parametric shape creation
    this.handleEvent("create_parametric_shape", (params) => {
      console.log("Creating parametric shape:", params)
      this.createParametricShape(params)
    })
    
    // Handle GLB to mesh conversion
    this.handleEvent("convert_to_mesh", ({id}) => {
      const object = this.objects.find(obj => obj.userData.id == id)
      if (object && object.userData.type === 'glb') {
        this.convertGLBToEditableMesh(object)
        this.deselectObject()
      }
    })
    
    // Handle transform mode changes
    this.handleEvent("set_transform_mode", ({mode}) => {
      this.setTransformMode(mode)
    })
    
    // Handle transform space toggle
    this.handleEvent("toggle_transform_space", () => {
      this.toggleTransformSpace()
    })
  },

  initThree() {
    // Get scene config from Phoenix
    const sceneConfig = JSON.parse(this.el.dataset.sceneConfig || '{}')
    console.log('Scene config:', sceneConfig)
    console.log('Container dimensions:', this.el.clientWidth, this.el.clientHeight)
    
    Promise.all([
      import('three'),
      import('three/examples/jsm/controls/OrbitControls.js'),
      import('three/examples/jsm/loaders/GLTFLoader.js'),
      import('three/examples/jsm/exporters/GLTFExporter.js'),
      import('three/examples/jsm/loaders/RGBELoader.js')
    ]).then(([THREE, OrbitControlsModule, GLTFLoaderModule, GLTFExporterModule, RGBELoaderModule]) => {
      console.log('Modules loaded:', { THREE, OrbitControlsModule, GLTFLoaderModule, GLTFExporterModule, RGBELoaderModule })
      
      this.THREE = THREE
      const { OrbitControls } = OrbitControlsModule
      const { GLTFLoader } = GLTFLoaderModule
      const { GLTFExporter } = GLTFExporterModule
      
      const container = this.el
      
      // Ensure container has dimensions
      if (container.clientWidth === 0 || container.clientHeight === 0) {
        console.error('Container has no dimensions:', container.clientWidth, container.clientHeight)
        // Try again after a short delay
        setTimeout(() => this.initThree(), 100)
        return
      }
      
      // Scene - Professional Design Studio
      const scene = new THREE.Scene()
      scene.background = new THREE.Color(sceneConfig.background_color || '#2a2a2a') // Dark studio grey
      
      // Camera - Professional studio angle with extreme zoom capability
      const camera = new THREE.PerspectiveCamera(45, 1, 0.001, 1000) // Very small near plane for extreme close-ups
      camera.position.set(5, 3, 8) // Studio view angle
      camera.lookAt(0, 0, 0)
      
      // Renderer - High quality settings
      const renderer = new THREE.WebGLRenderer({ 
        antialias: true,
        alpha: true,
        logarithmicDepthBuffer: true
      })
      renderer.setSize(container.clientWidth, container.clientHeight)
      renderer.shadowMap.enabled = true
      renderer.shadowMap.type = THREE.PCFSoftShadowMap
      renderer.toneMapping = THREE.ACESFilmicToneMapping
      renderer.toneMappingExposure = 1
      renderer.outputColorSpace = THREE.SRGBColorSpace
      container.appendChild(renderer.domElement)
      
      // Create scene elements from Phoenix config
      this.createSceneElements(THREE, scene, sceneConfig)
      
      // Studio ground plane - infinity cove style
      const groundGeometry = new THREE.PlaneGeometry(100, 100)
      const groundMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x4a4a4a,
        roughness: 0.9,
        metalness: 0.0
      })
      const ground = new THREE.Mesh(groundGeometry, groundMaterial)
      ground.rotation.x = -Math.PI / 2
      ground.receiveShadow = true
      ground.name = 'ground'
      scene.add(ground)
      
      // Remove backdrop for cleaner look
      // Just use the dark background
      
      // Remove HDRI for now - rely on direct lighting
      // This prevents the overly bright environment
      
      // Professional Studio Lighting Setup - Brighter
      
      // Stronger ambient for better base illumination
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.4)
      scene.add(ambientLight)
      console.log("Added ambient light with intensity:", ambientLight.intensity)
      
      // Key light - main directional light (brighter)
      const keyLight = new THREE.DirectionalLight(0xffffff, 1.2)
      keyLight.position.set(5, 10, 5)
      keyLight.castShadow = true
      keyLight.shadow.mapSize.width = 2048
      keyLight.shadow.mapSize.height = 2048
      keyLight.shadow.camera.near = 0.5
      keyLight.shadow.camera.far = 50
      keyLight.shadow.camera.left = -15
      keyLight.shadow.camera.right = 15
      keyLight.shadow.camera.top = 15
      keyLight.shadow.camera.bottom = -15
      keyLight.shadow.bias = -0.0005
      scene.add(keyLight)
      
      // Fill light - softer from opposite side (brighter)
      const fillLight = new THREE.DirectionalLight(0xffffff, 0.6)
      fillLight.position.set(-5, 8, -5)
      scene.add(fillLight)
      
      // Rim light - for edge highlights (brighter)
      const rimLight = new THREE.DirectionalLight(0xffffff, 0.5)
      rimLight.position.set(0, 10, -10)
      scene.add(rimLight)
      
      // Spotlight on center modeling area (brighter)
      const spotlight = new THREE.SpotLight(0xffffff, 1.5)
      spotlight.position.set(0, 15, 0)
      spotlight.target.position.set(0, 0, 0)
      spotlight.angle = Math.PI / 6
      spotlight.penumbra = 0.2
      spotlight.decay = 2
      spotlight.distance = 30
      spotlight.castShadow = true
      spotlight.shadow.mapSize.width = 1024
      spotlight.shadow.mapSize.height = 1024
      scene.add(spotlight)
      scene.add(spotlight.target)
      
      // DRAGGABLE LIGHT ON RAIL - DISABLED UNTIL FIXED
      /*
      // Create rail visualization
      const railGeometry = new THREE.CylinderGeometry(0.05, 0.05, 20)
      const railMaterial = new THREE.MeshBasicMaterial({ color: 0x666666 })
      const rail = new THREE.Mesh(railGeometry, railMaterial)
      rail.position.set(0, 10, 8)
      rail.rotation.z = Math.PI / 2
      scene.add(rail)
      
      // Create draggable light fixture
      const fixtureGeometry = new THREE.ConeGeometry(0.5, 1, 8)
      const fixtureMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xffff00
      })
      const lightFixture = new THREE.Mesh(fixtureGeometry, fixtureMaterial)
      lightFixture.rotation.x = Math.PI
      
      // Create the actual draggable light
      const draggableLight = new THREE.SpotLight(0xffffff, 2)
      draggableLight.angle = Math.PI / 4
      draggableLight.penumbra = 0.2
      draggableLight.decay = 2
      draggableLight.distance = 20
      draggableLight.castShadow = true
      
      // Set light target BEFORE adding to container
      draggableLight.target.position.set(0, 0, 0)
      scene.add(draggableLight.target)
      
      // Light container that can be dragged
      const lightContainer = new THREE.Group()
      lightContainer.add(lightFixture)
      lightContainer.add(draggableLight)
      lightContainer.position.set(0, 10, 8)
      lightContainer.userData = {
        type: 'draggable_light',
        id: 'draggable_light_fixture',
        isDraggable: true,
        railY: 10,
        railZ: 8,
        minX: -10,
        maxX: 10
      }
      
      scene.add(lightContainer)
      this.draggableLight = lightContainer
      this.objects.push(lightContainer)
      */
      
      console.log("All lights added to scene. Checking visibility...")
      console.log("Ambient light visible:", ambientLight.visible)
      console.log("Key light visible:", keyLight.visible)
      console.log("Fill light visible:", fillLight.visible)
      console.log("Rim light visible:", rimLight.visible)
      console.log("Spot light visible:", spotlight.visible)
      
      // Store lights for later control
      this.lights = {
        ambient: ambientLight,
        key: keyLight,
        fill: fillLight,
        rim: rimLight,
        spot: spotlight
      }
      
      // Initialize light visibility based on Phoenix state
      const lightConfig = JSON.parse(this.el.dataset.lightConfig || '{}')
      console.log('Initial light configuration:', lightConfig)
      
      // Set initial visibility for all lights
      Object.keys(this.lights).forEach(lightType => {
        const enabled = lightConfig[lightType] !== false // Default to true if not specified
        this.lights[lightType].visible = enabled
        console.log(`Light ${lightType} initialized to ${enabled}`)
      })
      
      // Professional camera controls
      const controls = new OrbitControls(camera, renderer.domElement)
      controls.enableDamping = true
      controls.dampingFactor = 0.05
      controls.minDistance = 0.01  // Allow VERY close zoom - basically microscopic
      controls.maxDistance = 200   // Allow zooming out much further too
      
      // Professional viewing angles
      controls.maxPolarAngle = Math.PI * 0.85 // Can look mostly down but not under
      controls.minPolarAngle = 0.1 // Slight limit at top
      
      // Focus on center of modeling area
      controls.target.set(0, 0, 0)
      
      // Adjust zoom speed for better control when very close
      controls.zoomSpeed = 1.5
      
      // Skip TransformControls for now - we'll use custom dragging
      let transformControls = null
      
      // Initialize GLTF loader and exporter
      this.gltfLoader = new GLTFLoader()
      this.gltfExporter = new GLTFExporter()
      
      // Store references
      this.scene = scene
      this.camera = camera
      this.renderer = renderer
      this.controls = controls
      this.transformControls = transformControls
      this.objects = []
      this.selectedObject = null
      this.raycaster = new THREE.Raycaster()
      this.mouse = new THREE.Vector2()
      this.selectionHelper = null
      
      // Setup object selection
      this.setupObjectSelection()
      
      // Setup custom dragging
      this.setupCustomDragging()
      
      // Animation
      const animate = () => {
        requestAnimationFrame(animate)
        
        controls.update()
        
        // Rotate all objects
        this.objects.forEach(obj => {
          if (obj.userData.rotating) {
            obj.rotation.x += obj.userData.rotationSpeedX || 0.01
            obj.rotation.y += obj.userData.rotationSpeedY || 0.01
          }
        })
        
        renderer.render(scene, camera)
      }
      animate()
      
      // Debug check after first render
      setTimeout(() => {
        console.log("Checking lights after initial render:")
        if (this.lights) {
          Object.entries(this.lights).forEach(([name, light]) => {
            console.log(`${name} light:`, {
              visible: light.visible,
              intensity: light.intensity,
              position: light.position
            })
          })
        }
        console.log("Total lights in scene:", scene.children.filter(child => child.isLight).length)
        console.log("Scene background:", scene.background)
        console.log("Renderer exposure:", renderer.toneMappingExposure)
      }, 100)
      
      // Handle resize
      const resizeObserver = new ResizeObserver(() => {
        camera.aspect = container.clientWidth / container.clientHeight
        camera.updateProjectionMatrix()
        renderer.setSize(container.clientWidth, container.clientHeight)
      })
      resizeObserver.observe(container)
      
      // Listen for drop events
      this.setupDropZone()
      
      // Add draggable light after initialization
      setTimeout(() => {
        this.addDraggableLight()
      }, 500)
    }).catch(error => {
      console.error('Error loading Three.js modules:', error)
    })
  },

  createSceneElements(THREE, scene, config) {
    // Remove and dispose any existing grid helpers first
    const existingGrids = scene.children.filter(child => child.type === 'GridHelper')
    existingGrids.forEach(grid => {
      scene.remove(grid)
      if (grid.geometry) grid.geometry.dispose()
      if (grid.material) grid.material.dispose()
    })
    
    // Grid von Phoenix config
    if (config.grid_visible) {
      const gridHelper = new THREE.GridHelper(
        config.grid_size || 20, 
        config.grid_divisions || 20, 
        0x888888, 
        0x444444
      )
      scene.add(gridHelper)
      this.gridHelper = gridHelper  // Store reference for toggling
      console.log("Added grid helper to scene")
    }
    
    // Remove and dispose any existing axes helpers first
    const existingAxes = scene.children.filter(child => child.type === 'AxesHelper')
    existingAxes.forEach(axes => {
      scene.remove(axes)
      if (axes.geometry) axes.geometry.dispose()
      if (axes.material) axes.material.dispose()
    })
    
    // Axis helper
    const axesHelper = new THREE.AxesHelper(5)
    scene.add(axesHelper)
  },

  addDraggableLight() {
    if (!this.THREE || !this.scene) return
    
    console.log("Adding draggable light...")
    
    // Create a rail visualization
    const railGeometry = new this.THREE.CylinderGeometry(0.05, 0.05, 20)
    const railMaterial = new this.THREE.MeshBasicMaterial({ color: 0x666666 })
    const rail = new this.THREE.Mesh(railGeometry, railMaterial)
    rail.position.set(0, 10, 8)
    rail.rotation.z = Math.PI / 2
    this.scene.add(rail)
    
    // Create light container
    const lightContainer = new this.THREE.Group()
    lightContainer.position.set(0, 10, 8)
    
    // Add visual indicator
    const indicatorGeometry = new this.THREE.ConeGeometry(0.5, 1, 8)
    const indicatorMaterial = new this.THREE.MeshBasicMaterial({ 
      color: 0xffff00,
      emissive: 0xffff00,
      emissiveIntensity: 0.5 
    })
    const indicator = new this.THREE.Mesh(indicatorGeometry, indicatorMaterial)
    indicator.rotation.x = Math.PI
    lightContainer.add(indicator)
    
    // Add point light
    const pointLight = new this.THREE.PointLight(0xffffff, 1.0)
    pointLight.castShadow = true
    lightContainer.add(pointLight)
    
    // Set user data for dragging
    lightContainer.userData = {
      type: 'draggable_light',
      id: 'rail_light_' + Date.now(),
      isDraggable: true,
      constrainX: true,
      minX: -10,
      maxX: 10,
      fixedY: 10,
      fixedZ: 8
    }
    
    this.scene.add(lightContainer)
    this.objects.push(lightContainer)
    
    // Store reference
    this.railLight = {
      container: lightContainer,
      light: pointLight,
      visible: true
    }
    
    console.log("Draggable light added successfully")
  },

  setupDropZone() {
    const container = this.el
    
    container.addEventListener('dragover', (e) => {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
      container.style.background = 'rgba(59, 130, 246, 0.1)'
    })
    
    container.addEventListener('dragleave', (e) => {
      e.preventDefault()
      container.style.background = ''
    })
    
    container.addEventListener('drop', (e) => {
      e.preventDefault()
      container.style.background = ''
      
      // Check for files first (GLB/GLTF models)
      if (e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0]
        if (file.name.toLowerCase().endsWith('.glb') || file.name.toLowerCase().endsWith('.gltf')) {
          this.loadGLBFile(file, e)
          return
        }
      }
      
      // Otherwise handle component drops
      const componentType = e.dataTransfer.getData('component-type')
      if (!componentType) return
      
      console.log('Dropped component:', componentType)
      
      // Calculate drop position
      const rect = container.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      const y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      
      // Add component to scene
      this.addComponent(componentType, x, y)
    })
  },

  addComponent(type, x, y) {
    console.log(`Adding ${type} at ${x}, ${y}`)
    
    if (!this.THREE) return
    
    // Convert screen coordinates to 3D world coordinates
    const raycaster = new this.THREE.Raycaster()
    const mouse = new this.THREE.Vector2(x, y)
    raycaster.setFromCamera(mouse, this.camera)
    
    // Find intersection with floor
    const floorPlane = new this.THREE.Plane(new this.THREE.Vector3(0, 1, 0), 0)
    const intersectPoint = new this.THREE.Vector3()
    raycaster.ray.intersectPlane(floorPlane, intersectPoint)
    
    switch(type) {
      case 'cube':
        this.createCube(intersectPoint)
        break
      case 'sphere':
        this.createSphere(intersectPoint)
        break
    }
    
    // Get the ID from the last added object
    const lastObject = this.objects[this.objects.length - 1]
    const componentId = lastObject?.userData?.id
    
    this.pushEvent('component_added', { 
      type, 
      x: intersectPoint.x, 
      y: intersectPoint.y, 
      z: intersectPoint.z,
      id: componentId?.toString(),
      rotating: true,
      rotationSpeedX: 0.01,
      rotationSpeedY: 0.01
    })
  },


  createCube(position) {
    const geometry = new this.THREE.BoxGeometry(0.5, 0.5, 0.5)
    const material = new this.THREE.MeshStandardMaterial({ 
      color: 0x2194ce,
      roughness: 0.5,
      metalness: 0.1
    })
    const cube = new this.THREE.Mesh(geometry, material)
    
    cube.position.copy(position)
    cube.position.y = 0.25
    cube.castShadow = true
    cube.receiveShadow = true
    
    cube.userData = {
      type: 'cube',
      rotating: true,
      rotationSpeedX: 0.01,
      rotationSpeedY: 0.01,
      id: Date.now()
    }
    
    this.scene.add(cube)
    this.objects.push(cube)
  },

  createSphere(position) {
    const geometry = new this.THREE.SphereGeometry(0.3, 32, 16)
    const material = new this.THREE.MeshStandardMaterial({ 
      color: 0xff6b6b,
      roughness: 0.3,
      metalness: 0.2
    })
    const sphere = new this.THREE.Mesh(geometry, material)
    
    sphere.position.copy(position)
    sphere.position.y = 0.3
    sphere.castShadow = true
    sphere.receiveShadow = true
    
    sphere.userData = {
      type: 'sphere',
      rotating: true,
      rotationSpeedX: 0.01,
      rotationSpeedY: 0.01,
      id: Date.now()
    }
    
    this.scene.add(sphere)
    this.objects.push(sphere)
  },

  setupObjectSelection() {
    // Single click handler
    this.renderer.domElement.addEventListener('click', (event) => {
      // Don't select when transform controls are active
      if (this.transformControls && this.transformControls.dragging) return
      
      const rect = this.renderer.domElement.getBoundingClientRect()
      this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
      
      this.raycaster.setFromCamera(this.mouse, this.camera)
      
      // Check ALL scene objects to see what we're actually clicking
      const allIntersects = this.raycaster.intersectObjects(this.scene.children, true)
      console.log("Scene structure:", this.scene.children.map(c => ({type: c.type, children: c.children.length})))
      console.log("All intersects:", allIntersects.map(i => ({
        type: i.object.type, 
        name: i.object.name,
        parent: i.object.parent ? i.object.parent.type : 'none',
        isGridHelper: i.object.type === 'GridHelper' || i.object.type === 'LineSegments',
        object: i.object
      })))
      
      // Check objects recursively (true) to catch GLB model children
      const intersects = this.raycaster.intersectObjects(this.objects, true)
      
      if (intersects.length > 0) {
        let selectedObject = intersects[0].object
        
        // For GLB models and mesh groups, we need to find the parent object that's in our objects array
        let targetObject = selectedObject
        while (targetObject.parent && !this.objects.includes(targetObject)) {
          targetObject = targetObject.parent
        }
        
        // If we found an object in our objects array, select it
        if (this.objects.includes(targetObject)) {
          this.selectObject(targetObject)
          return
        }
      }
      
      // Click on empty space - deselect
      this.deselectObject()
      this.pushEvent("component_deselected", {})
    })
    
    
    // Keyboard shortcuts
    window.addEventListener('keydown', (event) => {
      if (!this.selectedObject) return
      
      switch(event.key.toLowerCase()) {
        case 'delete':
        case 'backspace':
          this.deleteSelectedObject()
          break
        case 'w':
          this.setTransformMode('translate')
          break
        case 'e':
          this.setTransformMode('rotate')
          break
        case 'r':
          this.setTransformMode('scale')
          break
        case 'q':
          this.toggleTransformSpace()
          break
      }
    })
  },
  
  selectObject(object) {
    console.log('Selecting object:', object.userData.type, object)
    console.log('Scene children before select:', this.scene.children.length)
    console.log('Grid helpers in scene before:', this.scene.children.filter(c => c.type === 'GridHelper').length)
    
    this.deselectObject()
    this.selectedObject = object
    
    console.log('Scene children after select:', this.scene.children.length)
    console.log('Grid helpers in scene after:', this.scene.children.filter(c => c.type === 'GridHelper').length)
    
    // Create selection helper (bounding box)
    const box = new this.THREE.Box3().setFromObject(object)
    const helper = new this.THREE.Box3Helper(box, 0xffff00)
    this.scene.add(helper)
    this.selectionHelper = helper
    
    // No transform controls to attach anymore
    
    // Notify Phoenix about selection
    let color = '#ffffff' // default color
    if (object.material && object.material.color) {
      color = '#' + object.material.color.getHexString()
    } else if (object.userData.type === 'glb') {
      // For GLB models, we'll use a default or stored color
      color = object.userData.color || '#ffffff'
    } else if (object.userData.type === 'mesh' && object.userData.solidMesh) {
      // For converted meshes, get color from the solid mesh
      const solidMesh = object.userData.solidMesh
      if (solidMesh.material && solidMesh.material.color) {
        color = '#' + solidMesh.material.color.getHexString()
      }
    } else if (object.userData.type === 'parametric' && object.material && object.material.color) {
      color = '#' + object.material.color.getHexString()
    }
    
    this.pushEvent("component_selected", {
      id: object.userData.id,
      type: object.userData.type,
      position: {
        x: object.position.x,
        y: object.position.y,
        z: object.position.z
      },
      color: color
    })
    
    // Visual feedback - for all selectable objects
    if (object.userData.type === 'cube' || object.userData.type === 'sphere' || object.userData.type === 'parametric') {
      // Store original color
      if (!object.userData.originalColor) {
        object.userData.originalColor = object.material.color.getHex()
      }
      // Highlight with emissive
      object.material.emissive = new this.THREE.Color(0xffffff)
      object.material.emissiveIntensity = 0.3
    } else if (object.userData.type === 'glb') {
      // For GLB models, traverse and highlight all meshes
      object.traverse((child) => {
        if (child.isMesh && child.material) {
          if (!child.userData.originalEmissive) {
            child.userData.originalEmissive = child.material.emissive ? child.material.emissive.getHex() : 0x000000
          }
          child.material.emissive = new this.THREE.Color(0xffffff)
          child.material.emissiveIntensity = 0.1
        }
      })
    } else if (object.userData.type === 'mesh') {
      // For converted meshes, highlight the solid mesh
      if (object.userData.solidMesh && object.userData.solidMesh.material) {
        const material = object.userData.solidMesh.material
        if (!material.userData) material.userData = {}
        if (!material.userData.originalEmissive) {
          material.userData.originalEmissive = material.emissive ? material.emissive.getHex() : 0x000000
        }
        material.emissive = new this.THREE.Color(0xffffff)
        material.emissiveIntensity = 0.2
      }
    } else if (object.userData.type === 'draggable_light') {
      // For draggable light, highlight the fixture
      const fixture = object.children[0]
      if (fixture && fixture.material) {
        fixture.material.emissive = new this.THREE.Color(0xffff00)
        fixture.material.emissiveIntensity = 0.5
      }
    }
  },
  
  deselectObject() {
    if (this.selectedObject) {
      console.log('Deselecting object')
      console.log('Scene children before deselect:', this.scene.children.length)
      console.log('Grid helpers before deselect:', this.scene.children.filter(c => c.type === 'GridHelper').length)
      
      // Remove selection helper
      if (this.selectionHelper) {
        this.scene.remove(this.selectionHelper)
        this.selectionHelper.geometry.dispose()
        this.selectionHelper = null
      }
      
      // No transform controls to detach
      
      console.log('Scene children after removing selection helper:', this.scene.children.length)
      console.log('Grid helpers after removing selection helper:', this.scene.children.filter(c => c.type === 'GridHelper').length)
      
      // Reset visual feedback - for all selectable objects
      if (this.selectedObject.userData.type === 'cube' || this.selectedObject.userData.type === 'sphere' || this.selectedObject.userData.type === 'parametric') {
        // Reset emissive
        this.selectedObject.material.emissive = new this.THREE.Color(0x000000)
        this.selectedObject.material.emissiveIntensity = 0
      } else if (this.selectedObject.userData.type === 'glb') {
        // For GLB models, traverse and reset all meshes
        this.selectedObject.traverse((child) => {
          if (child.isMesh && child.material && child.userData.originalEmissive !== undefined) {
            child.material.emissive = new this.THREE.Color(child.userData.originalEmissive)
            child.material.emissiveIntensity = 0
          }
        })
      } else if (this.selectedObject.userData.type === 'mesh') {
        // For converted meshes, reset the solid mesh
        if (this.selectedObject.userData.solidMesh && this.selectedObject.userData.solidMesh.material) {
          const material = this.selectedObject.userData.solidMesh.material
          if (material.userData && material.userData.originalEmissive !== undefined) {
            material.emissive = new this.THREE.Color(material.userData.originalEmissive)
            material.emissiveIntensity = 0
          }
        }
      } else if (this.selectedObject.userData.type === 'draggable_light') {
        // For draggable light, reset the fixture
        const fixture = this.selectedObject.children[0]
        if (fixture && fixture.material) {
          fixture.material.emissive = new this.THREE.Color(0x000000)
          fixture.material.emissiveIntensity = 0
        }
      }
      
      this.selectedObject = null
      
      // Reset cursor
      if (this.renderer && this.renderer.domElement) {
        this.renderer.domElement.style.cursor = 'auto'
      }
    }
  },
  
  deleteSelectedObject() {
    if (!this.selectedObject) return
    
    // Allow deletion of all object types
    console.log("Deleting object:", this.selectedObject.userData.type)
    
    // Remove from scene
    this.scene.remove(this.selectedObject)
    
    // Clean up GLB model resources
    if (this.selectedObject.userData.type === 'glb') {
      this.selectedObject.traverse((child) => {
        if (child.geometry) child.geometry.dispose()
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(material => material.dispose())
          } else {
            child.material.dispose()
          }
        }
      })
    }
    
    // Remove from objects array
    const objIndex = this.objects.indexOf(this.selectedObject)
    if (objIndex > -1) {
      this.objects.splice(objIndex, 1)
    }
    
    this.deselectObject()
  },


  setupCustomDragging() {
    let isDragging = false
    let dragMode = 'horizontal' // 'horizontal' or 'vertical'
    let dragPlane = new this.THREE.Plane()
    let offset = new this.THREE.Vector3()
    let intersection = new this.THREE.Vector3()
    
    // Initialize transform mode
    this.transformMode = 'translate' // translate, rotate, scale
    this.transformSpace = 'world' // world, local
    
    // For rotation
    let startRotation = new this.THREE.Euler()
    let startMouseX = 0
    let startMouseY = 0
    
    // For scale
    let startScale = new this.THREE.Vector3()
    let startDistance = 0
    
    // Listen for shift key to change drag mode
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Shift' && isDragging && this.transformMode === 'translate') {
        dragMode = 'vertical'
        updateDragPlane()
      }
    })
    
    window.addEventListener('keyup', (event) => {
      if (event.key === 'Shift' && isDragging && this.transformMode === 'translate') {
        dragMode = 'horizontal'
        updateDragPlane()
      }
    })
    
    const updateDragPlane = () => {
      if (!this.selectedObject) return
      
      // Get the actual world position of the object
      const worldPos = new this.THREE.Vector3()
      this.selectedObject.getWorldPosition(worldPos)
      
      if (dragMode === 'horizontal') {
        // Horizontal plane at object's Y position
        dragPlane.setFromNormalAndCoplanarPoint(
          new this.THREE.Vector3(0, 1, 0),
          worldPos
        )
      } else {
        // Vertical plane facing camera
        const cameraDirection = new this.THREE.Vector3()
        this.camera.getWorldDirection(cameraDirection)
        cameraDirection.y = 0
        cameraDirection.normalize()
        dragPlane.setFromNormalAndCoplanarPoint(
          cameraDirection,
          worldPos
        )
      }
    }
    
    this.renderer.domElement.addEventListener('mousedown', (event) => {
      if (this.selectedObject && event.button === 0) { // Left button
        isDragging = true
        this.controls.enabled = false
        
        const rect = this.renderer.domElement.getBoundingClientRect()
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
        
        if (this.transformMode === 'translate') {
          // Set initial drag plane
          updateDragPlane()
          
          // Calculate offset
          this.raycaster.setFromCamera(this.mouse, this.camera)
          if (this.raycaster.ray.intersectPlane(dragPlane, intersection)) {
            const worldPos = new this.THREE.Vector3()
            this.selectedObject.getWorldPosition(worldPos)
            offset.copy(intersection).sub(worldPos)
          }
        } else if (this.transformMode === 'rotate') {
          // Store initial rotation and mouse position
          startRotation.copy(this.selectedObject.rotation)
          startMouseX = event.clientX
          startMouseY = event.clientY
        } else if (this.transformMode === 'scale') {
          // Store initial scale and mouse distance
          startScale.copy(this.selectedObject.scale)
          startDistance = Math.sqrt(event.clientX * event.clientX + event.clientY * event.clientY)
        }
      }
    })
    
    this.renderer.domElement.addEventListener('mousemove', (event) => {
      if (isDragging && this.selectedObject) {
        const rect = this.renderer.domElement.getBoundingClientRect()
        
        if (this.transformMode === 'translate') {
          this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
          this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
          
          this.raycaster.setFromCamera(this.mouse, this.camera)
          
          if (this.raycaster.ray.intersectPlane(dragPlane, intersection)) {
            const newPosition = intersection.sub(offset)
            
            // Special handling for draggable light
            if (this.selectedObject.userData.type === 'draggable_light') {
              // Constrain to rail (only X movement)
              this.selectedObject.position.x = Math.max(
                this.selectedObject.userData.minX,
                Math.min(this.selectedObject.userData.maxX, newPosition.x)
              )
              // Keep Y and Z fixed on rail
              this.selectedObject.position.y = this.selectedObject.userData.railY
              this.selectedObject.position.z = this.selectedObject.userData.railZ
              
              // Update light target to follow
              if (this.selectedObject.children[1] && this.selectedObject.children[1].target) {
                this.selectedObject.children[1].target.position.x = this.selectedObject.position.x
              }
            } else {
              // Normal object dragging
              if (dragMode === 'horizontal') {
                // Keep Y constant when dragging horizontally
                newPosition.y = this.selectedObject.position.y
              }
              
              this.selectedObject.position.copy(newPosition)
            }
          }
        } else if (this.transformMode === 'rotate') {
          // Calculate rotation based on mouse movement
          const deltaX = (event.clientX - startMouseX) * 0.01
          const deltaY = (event.clientY - startMouseY) * 0.01
          
          this.selectedObject.rotation.x = startRotation.x + deltaY
          this.selectedObject.rotation.y = startRotation.y + deltaX
          this.selectedObject.rotation.z = startRotation.z
        } else if (this.transformMode === 'scale') {
          // Calculate scale based on mouse distance from center
          const currentDistance = Math.sqrt(event.clientX * event.clientX + event.clientY * event.clientY)
          const scaleFactor = currentDistance / startDistance
          
          // Apply uniform scaling
          this.selectedObject.scale.set(
            startScale.x * scaleFactor,
            startScale.y * scaleFactor,
            startScale.z * scaleFactor
          )
          
          // Clamp scale to reasonable values
          const minScale = 0.1
          const maxScale = 10
          this.selectedObject.scale.clampScalar(minScale, maxScale)
        }
        
        // Update selection helper for all transform modes
        if (this.selectionHelper) {
          const box = new this.THREE.Box3().setFromObject(this.selectedObject)
          this.selectionHelper.box = box
        }
      }
    })
    
    this.renderer.domElement.addEventListener('mouseup', () => {
      if (isDragging && this.selectedObject) {
        // Sync position when dragging ends
        this.syncObjectToPhoenix(this.selectedObject)
      }
      isDragging = false
      this.controls.enabled = true
      dragMode = 'horizontal' // Reset to horizontal
    })
    
    // Handle mouse leave
    this.renderer.domElement.addEventListener('mouseleave', () => {
      isDragging = false
      this.controls.enabled = true
      dragMode = 'horizontal'
    })
  },

  loadScene(objects, sceneConfig, cameraState, lightingConfig) {
    // Clear existing objects but preserve ground and lights
    this.objects.forEach(obj => {
      this.scene.remove(obj)
      if (obj.geometry) obj.geometry.dispose()
      if (obj.material) obj.material.dispose()
    })
    this.objects = []
    this.deselectObject()
    
    // Apply scene config
    if (sceneConfig) {
      if (sceneConfig.background_color) {
        this.scene.background = new this.THREE.Color(sceneConfig.background_color)
      }
      
      // Update grid
      if (this.gridHelper) {
        this.scene.remove(this.gridHelper)
        if (this.gridHelper.geometry) this.gridHelper.geometry.dispose()
        if (this.gridHelper.material) {
          if (Array.isArray(this.gridHelper.material)) {
            this.gridHelper.material.forEach(m => m.dispose())
          } else {
            this.gridHelper.material.dispose()
          }
        }
        this.gridHelper = null
      }
      
      if (sceneConfig.grid_visible) {
        this.gridHelper = new this.THREE.GridHelper(
          sceneConfig.grid_size || 20,
          sceneConfig.grid_divisions || 20,
          0x888888,
          0x444444
        )
        this.scene.add(this.gridHelper)
      }
    }
    
    // Apply camera state
    if (cameraState && cameraState.position) {
      this.camera.position.set(
        cameraState.position.x,
        cameraState.position.y,
        cameraState.position.z
      )
      this.camera.lookAt(0, 0, 0)
    }
    
    // Recreate objects
    objects.forEach(objData => {
      let object
      const position = new this.THREE.Vector3(
        objData.position.x,
        objData.position.y,
        objData.position.z
      )
      
      switch(objData.type) {
        case 'cube':
          const cubeGeometry = new this.THREE.BoxGeometry(0.5, 0.5, 0.5)
          const cubeMaterial = new this.THREE.MeshPhongMaterial({ color: objData.color || '#00ff00' })
          object = new this.THREE.Mesh(cubeGeometry, cubeMaterial)
          break
          
        case 'sphere':
          const sphereGeometry = new this.THREE.SphereGeometry(0.3, 32, 16)
          const sphereMaterial = new this.THREE.MeshPhongMaterial({ color: objData.color || '#0066ff' })
          object = new this.THREE.Mesh(sphereGeometry, sphereMaterial)
          break
          
        case 'glb':
          // Create a placeholder for GLB models (since we can't recreate the actual model)
          const placeholderGeometry = new this.THREE.BoxGeometry(1, 1, 1)
          const placeholderMaterial = new this.THREE.MeshPhongMaterial({ 
            color: 0x808080,
            wireframe: true
          })
          object = new this.THREE.Mesh(placeholderGeometry, placeholderMaterial)
          
          // Add text to show it's a GLB placeholder
          console.log(`GLB model placeholder for: ${objData.filename || 'unknown.glb'}`)
          break
          
        case 'parametric':
          // Recreate parametric shapes
          const params = objData.params || {}
          switch(objData.shape) {
            case 'box':
              object = new this.THREE.Mesh(
                new this.THREE.BoxGeometry(
                  params.width || 1,
                  params.height || 1,
                  params.depth || 1,
                  Math.floor(params.widthSegments || 1),
                  Math.floor(params.heightSegments || 1),
                  Math.floor(params.depthSegments || 1)
                ),
                new this.THREE.MeshStandardMaterial({ color: objData.color || 0x4a90e2 })
              )
              break
            case 'cylinder':
              object = new this.THREE.Mesh(
                new this.THREE.CylinderGeometry(
                  params.radiusTop || 0.5,
                  params.radiusBottom || 0.5,
                  params.height || 1,
                  Math.floor(params.radialSegments || 8),
                  Math.floor(params.heightSegments || 1)
                ),
                new this.THREE.MeshStandardMaterial({ color: objData.color || 0x4a90e2 })
              )
              break
            case 'torus':
              object = new this.THREE.Mesh(
                new this.THREE.TorusGeometry(
                  params.radius || 0.5,
                  params.tube || 0.2,
                  Math.floor(params.radialSegments || 8),
                  Math.floor(params.tubularSegments || 16)
                ),
                new this.THREE.MeshStandardMaterial({ color: objData.color || 0x4a90e2 })
              )
              break
            case 'cone':
              object = new this.THREE.Mesh(
                new this.THREE.ConeGeometry(
                  params.radius || 0.5,
                  params.height || 1,
                  Math.floor(params.radialSegments || 8)
                ),
                new this.THREE.MeshStandardMaterial({ color: objData.color || 0x4a90e2 })
              )
              break
            case 'plane':
              object = new this.THREE.Mesh(
                new this.THREE.PlaneGeometry(
                  params.width || 2,
                  params.height || 2,
                  Math.floor(params.widthSegments || 1),
                  Math.floor(params.heightSegments || 1)
                ),
                new this.THREE.MeshStandardMaterial({ color: objData.color || 0x4a90e2 })
              )
              break
          }
          break
          
        case 'mesh':
          // Recreate converted meshes
          const meshGeometry = new this.THREE.BoxGeometry(0.5, 0.5, 0.5)
          const meshMaterial = new this.THREE.MeshStandardMaterial({ 
            color: objData.color || 0x808080
          })
          object = new this.THREE.Mesh(meshGeometry, meshMaterial)
          break
          
        default:
          return // Skip unknown types
      }
      
      if (object) {
        object.position.copy(position)
        object.rotation.set(
          objData.rotation.x,
          objData.rotation.y,
          objData.rotation.z
        )
        object.scale.set(
          objData.scale.x,
          objData.scale.y,
          objData.scale.z
        )
        
        object.castShadow = true
        object.receiveShadow = true
        
        object.userData = {
          id: objData.id,
          type: objData.type,
          rotating: objData.rotating || false,
          rotationSpeedX: objData.rotationSpeedX || 0.01,
          rotationSpeedY: objData.rotationSpeedY || 0.01,
          color: objData.color
        }
        
        this.scene.add(object)
        this.objects.push(object)
      }
    })
  },
  
  setTransformMode(mode) {
    console.log(`Transform mode: ${mode}`)
    // Store mode for custom dragging
    this.transformMode = mode
    
    // Show visual feedback
    const modeText = mode === 'translate' ? 'Move Mode (W)' : mode === 'rotate' ? 'Rotate Mode (E)' : 'Scale Mode (R)'
    this.updateHelpText(modeText)
    
    // Update cursor style based on mode
    if (this.renderer && this.renderer.domElement) {
      switch(mode) {
        case 'translate':
          this.renderer.domElement.style.cursor = 'move'
          break
        case 'rotate':
          this.renderer.domElement.style.cursor = 'alias'
          break
        case 'scale':
          this.renderer.domElement.style.cursor = 'nwse-resize'
          break
      }
    }
  },
  
  toggleTransformSpace() {
    // Toggle between local and world space for custom transforms
    this.transformSpace = this.transformSpace === 'local' ? 'world' : 'local'
    console.log(`Transform space: ${this.transformSpace}`)
    
    // Show visual feedback
    this.updateHelpText(`Space: ${this.transformSpace.toUpperCase()}`)
  },
  
  updateHelpText(message) {
    // Create temporary overlay for mode feedback
    const overlay = document.createElement('div')
    overlay.style.position = 'absolute'
    overlay.style.top = '20px'
    overlay.style.left = '50%'
    overlay.style.transform = 'translateX(-50%)'
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.8)'
    overlay.style.color = 'white'
    overlay.style.padding = '10px 20px'
    overlay.style.borderRadius = '5px'
    overlay.style.fontSize = '16px'
    overlay.style.zIndex = '1000'
    overlay.textContent = message
    
    this.el.appendChild(overlay)
    
    setTimeout(() => {
      overlay.remove()
    }, 2000)
  },
  
  syncObjectToPhoenix(object) {
    if (!object || !object.userData.id) return
    
    // Send updated transform to Phoenix
    this.pushEvent("update_component", {
      id: object.userData.id,
      position: {
        x: object.position.x,
        y: object.position.y,
        z: object.position.z
      },
      rotation: {
        x: object.rotation.x,
        y: object.rotation.y,
        z: object.rotation.z
      },
      scale: {
        x: object.scale.x,
        y: object.scale.y,
        z: object.scale.z
      }
    })
  },

  getCompleteSceneState() {
    // Collect all object states
    const objects = this.objects.map(obj => {
      const baseData = {
        id: obj.userData.id,
        type: obj.userData.type,
        position: {
          x: obj.position.x,
          y: obj.position.y,
          z: obj.position.z
        },
        rotation: {
          x: obj.rotation.x,
          y: obj.rotation.y,
          z: obj.rotation.z
        },
        scale: {
          x: obj.scale.x,
          y: obj.scale.y,
          z: obj.scale.z
        },
        rotating: obj.userData.rotating || false,
        rotationSpeedX: obj.userData.rotationSpeedX || 0.01,
        rotationSpeedY: obj.userData.rotationSpeedY || 0.01
      }
      
      // Add type-specific data
      if (obj.userData.type === 'glb') {
        baseData.filename = obj.userData.filename
        baseData.color = '#ffffff' // GLB models don't have a single color
      } else if (obj.userData.type === 'parametric') {
        baseData.shape = obj.userData.shape
        baseData.params = obj.userData.params
        baseData.color = obj.material && obj.material.color ? '#' + obj.material.color.getHexString() : '#ffffff'
      } else {
        baseData.color = obj.material && obj.material.color ? '#' + obj.material.color.getHexString() : '#ffffff'
      }
      
      return baseData
    })
    
    // Collect scene configuration
    const sceneConfig = {
      background_color: this.scene.background ? '#' + this.scene.background.getHexString() : '#1a1a1a',
      grid_visible: this.gridHelper ? this.gridHelper.visible : true,
      grid_size: this.gridHelper ? this.gridHelper.parameters.size : 20,
      grid_divisions: this.gridHelper ? this.gridHelper.parameters.divisions : 20,
      camera: {
        position: {
          x: this.camera.position.x,
          y: this.camera.position.y,
          z: this.camera.position.z
        },
        rotation: {
          x: this.camera.rotation.x,
          y: this.camera.rotation.y,
          z: this.camera.rotation.z
        },
        fov: this.camera.fov,
        near: this.camera.near,
        far: this.camera.far
      },
      lighting: {
        ambient: {
          color: '#ffffff',
          intensity: 0.4
        },
        directional: {
          color: '#ffffff',
          intensity: 0.6,
          position: { x: 5, y: 8, z: 5 }
        }
      }
    }
    
    return { objects, scene_config: sceneConfig }
  },

  loadGLBFile(file, dropEvent) {
    const reader = new FileReader()
    reader.onload = (e) => {
      const arrayBuffer = e.target.result
      
      // Calculate drop position
      const rect = this.el.getBoundingClientRect()
      const x = ((dropEvent.clientX - rect.left) / rect.width) * 2 - 1
      const y = -((dropEvent.clientY - rect.top) / rect.height) * 2 + 1
      
      // Find intersection with floor
      const raycaster = new this.THREE.Raycaster()
      raycaster.setFromCamera(new this.THREE.Vector2(x, y), this.camera)
      const floorPlane = new this.THREE.Plane(new this.THREE.Vector3(0, 1, 0), 0)
      const intersectPoint = new this.THREE.Vector3()
      raycaster.ray.intersectPlane(floorPlane, intersectPoint)
      
      this.gltfLoader.parse(arrayBuffer, '', (gltf) => {
        const model = gltf.scene
        
        // Position at drop location
        model.position.copy(intersectPoint)
        
        // Scale model to reasonable size if needed
        const box = new this.THREE.Box3().setFromObject(model)
        const size = box.getSize(new this.THREE.Vector3())
        const maxSize = Math.max(size.x, size.y, size.z)
        if (maxSize > 2) {
          const scale = 2 / maxSize
          model.scale.setScalar(scale)
        }
        
        // Add to scene and objects
        model.userData = {
          type: 'glb',
          id: Date.now(),
          filename: file.name,
          rotating: false,
          color: '#ffffff'
        }
        
        // Enable shadows for all meshes in the model
        model.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true
            child.receiveShadow = true
          }
        })
        
        this.scene.add(model)
        this.objects.push(model)
        
        // Notify Phoenix
        this.pushEvent('component_added', {
          type: 'glb',
          x: model.position.x,
          y: model.position.y,
          z: model.position.z,
          id: model.userData.id.toString(),
          filename: file.name,
          rotating: false
        })
        
        console.log('Loaded GLB model:', file.name)
      }, (error) => {
        console.error('Error loading GLB:', error)
      })
    }
    reader.readAsArrayBuffer(file)
  },

  destroyed() {
    // Clean up Three.js resources when the hook is destroyed
    if (this.renderer) {
      this.renderer.dispose()
    }
    if (this.scene) {
      this.scene.traverse((object) => {
        if (object.geometry) object.geometry.dispose()
        if (object.material) {
          if (Array.isArray(object.material)) {
            object.material.forEach(material => material.dispose())
          } else {
            object.material.dispose()
          }
        }
      })
    }
  },
  
  exportSceneAsGLB() {
    if (!this.gltfExporter || !this.scene) return
    
    // Create a clean scene for export with only the objects
    const exportScene = new this.THREE.Scene()
    
    // Add all user objects to export scene
    this.objects.forEach(obj => {
      const clone = obj.clone(true)
      exportScene.add(clone)
    })
    
    // Export options
    const options = {
      binary: true,
      includeCustomExtensions: true
    }
    
    // Export the scene
    this.gltfExporter.parse(
      exportScene,
      (result) => {
        // Success callback
        if (result instanceof ArrayBuffer) {
          // Save the binary GLB file
          const blob = new Blob([result], { type: 'model/gltf-binary' })
          const link = document.createElement('a')
          link.href = URL.createObjectURL(blob)
          link.download = `scene_${new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-')}.glb`
          link.click()
          
          // Clean up
          URL.revokeObjectURL(link.href)
        }
      },
      (error) => {
        // Error callback
        console.error('Export error:', error)
      },
      options
    )
  },
  
  createParametricShape(params) {
    if (!this.THREE) return
    
    const shape = params.shape
    let geometry
    
    switch(shape) {
      case 'box':
        geometry = new this.THREE.BoxGeometry(
          params.width || 1,
          params.height || 1,
          params.depth || 1,
          Math.floor(params.widthSegments || 1),
          Math.floor(params.heightSegments || 1),
          Math.floor(params.depthSegments || 1)
        )
        break
        
      case 'cylinder':
        geometry = new this.THREE.CylinderGeometry(
          params.radiusTop || 0.5,
          params.radiusBottom || 0.5,
          params.height || 1,
          Math.floor(params.radialSegments || 8),
          Math.floor(params.heightSegments || 1)
        )
        break
        
      case 'torus':
        geometry = new this.THREE.TorusGeometry(
          params.radius || 0.5,
          params.tube || 0.2,
          Math.floor(params.radialSegments || 8),
          Math.floor(params.tubularSegments || 16)
        )
        break
        
      case 'cone':
        geometry = new this.THREE.ConeGeometry(
          params.radius || 0.5,
          params.height || 1,
          Math.floor(params.radialSegments || 8)
        )
        break
        
      case 'plane':
        geometry = new this.THREE.PlaneGeometry(
          params.width || 2,
          params.height || 2,
          Math.floor(params.widthSegments || 1),
          Math.floor(params.heightSegments || 1)
        )
        break
        
      default:
        console.error('Unknown parametric shape:', shape)
        return
    }
    
    // Create material
    const material = new this.THREE.MeshStandardMaterial({
      color: 0x4a90e2,
      roughness: 0.5,
      metalness: 0.1,
      wireframe: params.wireframe || false
    })
    
    // Create mesh
    const mesh = new this.THREE.Mesh(geometry, material)
    
    // Position at center
    mesh.position.set(0, shape === 'plane' ? 0 : 0.5, 0)
    if (shape === 'plane') {
      mesh.rotation.x = -Math.PI / 2
    }
    
    mesh.castShadow = true
    mesh.receiveShadow = true
    
    // Add user data
    mesh.userData = {
      type: 'parametric',
      shape: shape,
      params: params,
      id: Date.now(),
      rotating: false,
      editable: true
    }
    
    // Add to scene
    this.scene.add(mesh)
    this.objects.push(mesh)
    
    // Notify Phoenix
    this.pushEvent('component_added', {
      type: 'parametric',
      shape: shape,
      x: mesh.position.x,
      y: mesh.position.y,
      z: mesh.position.z,
      id: mesh.userData.id.toString(),
      params: params,
      rotating: false
    })
    
    // Auto-select the new shape
    this.selectObject(mesh)
  },
  
  convertGLBToEditableMesh(glbObject) {
    if (!glbObject || glbObject.userData.type !== 'glb') return
    
    const meshes = []
    const glbPosition = glbObject.position.clone()
    const glbRotation = glbObject.rotation.clone()
    const glbScale = glbObject.scale.clone()
    
    // Extract all meshes from the GLB
    glbObject.traverse((child) => {
      if (child.isMesh) {
        // Clone the geometry
        const geometry = child.geometry.clone()
        
        // Create both solid and wireframe materials
        const material = child.material.clone()
        material.transparent = true
        material.opacity = 0.8
        
        // Create the main mesh
        const editableMesh = new this.THREE.Mesh(geometry, material)
        
        // Create wireframe overlay
        const wireframeMaterial = new this.THREE.MeshBasicMaterial({
          color: 0x00ff00,
          wireframe: true,
          transparent: true,
          opacity: 0.3
        })
        const wireframeMesh = new this.THREE.Mesh(geometry, wireframeMaterial)
        
        // Add both to a group
        const meshContainer = new this.THREE.Group()
        meshContainer.add(editableMesh)
        meshContainer.add(wireframeMesh)
        
        // Apply the world transform
        const worldMatrix = child.matrixWorld.clone()
        meshContainer.applyMatrix4(worldMatrix)
        
        // Add metadata with unique ID
        const meshId = Date.now() * 1000 + meshes.length // Ensure unique integer ID
        meshContainer.userData = {
          type: 'mesh',
          id: meshId,
          originalName: child.name || 'Mesh',
          fromGLB: glbObject.userData.filename,
          editable: true,
          rotating: false,
          wireframe: wireframeMesh,
          solidMesh: editableMesh
        }
        
        meshContainer.castShadow = true
        meshContainer.receiveShadow = true
        
        // Add directly to scene
        this.scene.add(meshContainer)
        meshes.push(meshContainer)
        this.objects.push(meshContainer)
        
        // Notify Phoenix about the new mesh
        this.pushEvent('component_added', {
          type: 'mesh',
          x: meshContainer.position.x,
          y: meshContainer.position.y,
          z: meshContainer.position.z,
          id: meshContainer.userData.id.toString(),
          color: '#808080',
          rotating: false
        })
      }
    })
    
    // Remove original GLB
    this.scene.remove(glbObject)
    const index = this.objects.indexOf(glbObject)
    if (index > -1) {
      this.objects.splice(index, 1)
    }
    
    // Notify user
    console.log(`Converted GLB to ${meshes.length} editable meshes with wireframe overlay`)
    
    // Show visual feedback
    this.updateHelpText(`Converted to ${meshes.length} editable meshes`)
    
    return meshes
  }
  
}

export default ShowcaseRoom