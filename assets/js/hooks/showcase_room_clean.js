const ShowcaseRoom = {
  mounted() {
    console.log('ShowcaseRoom hook mounted')
    
    // Check if Three.js is already initialized on this element
    if (this.el._threeJSInitialized) {
      console.log('Three.js already initialized on element, skipping setup')
      this.setupPhoenixEventHandlers()
      return
    }
    
    this.initThreeJS()
    this.setupPhoenixEventHandlers()
    this.el._threeJSInitialized = true
  },

  setupPhoenixEventHandlers() {
    this.handleEvent("component_created", (component) => {
      console.log("Component created:", component)
      const object = this.objects.find(obj => obj.userData.id == component.id)
      if (object) {
        object.userData = {...object.userData, ...component}
        if (object.material && component.color) {
          object.material.color.set(component.color)
        }
      }
    })
    
    this.handleEvent("update_component_position", ({id, axis, value}) => {
      const object = this.objects.find(obj => obj.userData.id == id)
      if (object) {
        object.position[axis] = parseFloat(value)
      }
    })
    
    this.handleEvent("update_component_color", ({id, color}) => {
      const object = this.objects.find(obj => obj.userData.id == id)
      if (object && object.material) {
        object.material.color.set(color)
      }
    })
  },

  initThreeJS() {
    // Hardcode scene config to prevent remounts
    const sceneConfig = {
      background_color: '#1a1a1a',
      grid_visible: true,
      grid_size: 20,
      grid_divisions: 20
    }
    
    Promise.all([
      import('three'),
      import('three/examples/jsm/controls/OrbitControls.js'),
      import('three/examples/jsm/controls/TransformControls.js'),
      import('three/examples/jsm/loaders/GLTFLoader.js')
    ]).then(([THREE, OrbitControlsModule, TransformControlsModule, GLTFLoaderModule]) => {
      this.THREE = THREE
      const { OrbitControls } = OrbitControlsModule
      const { TransformControls } = TransformControlsModule
      const { GLTFLoader } = GLTFLoaderModule
      
      // Initialize loaders
      this.gltfLoader = new GLTFLoader()
      
      // Scene
      this.scene = new THREE.Scene()
      this.scene.background = new THREE.Color(sceneConfig.background_color || '#1a1a1a')
      
      // Camera
      this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000)
      this.camera.position.set(10, 10, 10)
      this.camera.lookAt(0, 0, 0)
      
      // Renderer
      this.renderer = new THREE.WebGLRenderer({ antialias: true })
      this.renderer.setSize(this.el.clientWidth, this.el.clientHeight)
      this.el.appendChild(this.renderer.domElement)
      
      // Initialize arrays first
      this.objects = []  // Only user-created objects (cubes, spheres)
      this.helpers = []  // Scene helpers (grid, axes)
      
      // Scene helpers
      this.setupSceneHelpers(sceneConfig)
      
      // Lighting
      this.setupLighting()
      
      // Controls
      this.controls = new OrbitControls(this.camera, this.renderer.domElement)
      this.controls.enableDamping = true
      this.controls.dampingFactor = 0.05
      
      // Transform controls for object manipulation
      this.transformControls = new TransformControls(this.camera, this.renderer.domElement)
      this.transformControls.setMode('translate') // Start with translate mode
      
      // Add the transform controls gizmo to the scene
      const gizmo = this.transformControls.getHelper()
      this.scene.add(gizmo)
      
      // Sync transform controls with orbit controls
      this.transformControls.addEventListener('dragging-changed', (event) => {
        this.controls.enabled = !event.value
      })
      
      // Selection system based on Three.js editor
      this.setupSelector()
      
      // Drop zone
      this.setupDropZone()
      
      // Animation loop
      this.animate()
      
      // Handle resize
      this.setupResize()
    })
  },

  setupSceneHelpers(config) {
    // Grid helper
    if (config.grid_visible) {
      const grid = new this.THREE.GridHelper(
        config.grid_size || 20,
        config.grid_divisions || 20,
        0x888888,
        0x444444
      )
      this.scene.add(grid)
      this.helpers.push(grid)
    }
    
    // Axes helper
    const axes = new this.THREE.AxesHelper(5)
    this.scene.add(axes)
    this.helpers.push(axes)
  },

  setupLighting() {
    const ambientLight = new this.THREE.AmbientLight(0xffffff, 0.4)
    this.scene.add(ambientLight)
    
    const directionalLight = new this.THREE.DirectionalLight(0xffffff, 0.6)
    directionalLight.position.set(5, 8, 5)
    directionalLight.castShadow = true
    this.scene.add(directionalLight)
  },

  setupSelector() {
    this.raycaster = new this.THREE.Raycaster()
    this.mouse = new this.THREE.Vector2()
    this.selectedObject = null
    this.selectionHelper = null
    
    // Mouse events for selection
    this.renderer.domElement.addEventListener('click', this.onPointerClick.bind(this))
    
    // Keyboard events
    window.addEventListener('keydown', this.onKeyDown.bind(this))
  },

  onPointerClick(event) {
    // Don't handle click if transform controls are active
    if (this.transformControls.dragging) return
    
    if (this.controls.enabled === false) return
    
    const rect = this.renderer.domElement.getBoundingClientRect()
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    
    const intersects = this.getIntersects()
    console.log('Intersects found:', intersects.length)
    console.log('Objects array:', this.objects.map(o => o.userData.type))
    
    if (intersects.length > 0) {
      const object = intersects[0].object
      console.log('Object clicked:', object.userData.type, object)
      console.log('Is in objects array:', this.objects.includes(object))
      
      // Check if clicked object is a child of a GLB model
      let targetObject = object
      while (targetObject.parent && !this.objects.includes(targetObject)) {
        targetObject = targetObject.parent
        console.log('Checking parent:', targetObject.userData.type)
      }
      
      if (this.objects.includes(targetObject)) {
        console.log('Selecting:', targetObject.userData.type)
        this.select(targetObject)
        return
      }
    }
    
    // Click on empty space - deselect
    console.log('Deselecting - empty space clicked')
    this.select(null)
  },

  getIntersects() {
    this.raycaster.setFromCamera(this.mouse, this.camera)
    
    // Raycast against user objects and their children (for GLB models)
    return this.raycaster.intersectObjects(this.objects, true)
  },

  select(object) {
    if (this.selectedObject === object) return
    
    // Deselect previous
    if (this.selectedObject) {
      this.removeSelectionHelper()
      this.resetObjectAppearance(this.selectedObject)
      this.transformControls.detach()
    }
    
    this.selectedObject = object
    
    if (object) {
      this.addSelectionHelper(object)
      this.highlightObject(object)
      
      // Attach transform controls to selected object
      this.transformControls.attach(object)
      
      // Get color from material (handle GLB models with multiple materials)
      let color = '#ffffff'
      if (object.material) {
        if (object.material.color) {
          color = '#' + object.material.color.getHexString()
        }
      } else if (object.children && object.children.length > 0) {
        // For GLB models, try to get color from first child with material
        const firstMesh = object.children.find(child => child.material && child.material.color)
        if (firstMesh) {
          color = '#' + firstMesh.material.color.getHexString()
        }
      }
      
      // Notify Phoenix
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
    } else {
      this.transformControls.detach()
      this.pushEvent("component_deselected", {})
    }
  },

  addSelectionHelper(object) {
    const box = new this.THREE.Box3().setFromObject(object)
    this.selectionHelper = new this.THREE.Box3Helper(box, 0xffff00)
    this.scene.add(this.selectionHelper)
  },

  removeSelectionHelper() {
    if (this.selectionHelper) {
      this.scene.remove(this.selectionHelper)
      this.selectionHelper.geometry.dispose()
      this.selectionHelper = null
    }
  },

  highlightObject(object) {
    if (object.material) {
      if (!object.userData.originalColor) {
        object.userData.originalColor = object.material.color.getHex()
      }
      object.material.emissive = new this.THREE.Color(0xffffff)
      object.material.emissiveIntensity = 0.3
    }
  },

  resetObjectAppearance(object) {
    if (object.material) {
      object.material.emissive = new this.THREE.Color(0x000000)
      object.material.emissiveIntensity = 0
    }
  },

  onKeyDown(event) {
    switch(event.key) {
      case 'w':
      case 'W':
        this.transformControls.setMode('translate')
        break
      case 'e':
      case 'E':
        this.transformControls.setMode('rotate')
        break
      case 'r':
      case 'R':
        this.transformControls.setMode('scale')
        break
      case 'q':
      case 'Q':
        // Toggle world/local space
        this.transformControls.setSpace(
          this.transformControls.space === 'local' ? 'world' : 'local'
        )
        break
      case 'Delete':
      case 'Backspace':
        if (this.selectedObject) {
          this.deleteSelectedObject()
        }
        break
    }
  },

  deleteSelectedObject() {
    if (!this.selectedObject) return
    
    this.scene.remove(this.selectedObject)
    
    const index = this.objects.indexOf(this.selectedObject)
    if (index > -1) {
      this.objects.splice(index, 1)
    }
    
    this.select(null)
  },

  setupDropZone() {
    this.el.addEventListener('dragover', (e) => {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
    })
    
    this.el.addEventListener('drop', (e) => {
      e.preventDefault()
      
      // Check for component type first
      const componentType = e.dataTransfer.getData('component-type')
      if (componentType) {
        const rect = this.el.getBoundingClientRect()
        const x = ((e.clientX - rect.left) / rect.width) * 2 - 1
        const y = -((e.clientY - rect.top) / rect.height) * 2 + 1
        
        this.addComponent(componentType, x, y)
        return
      }
      
      // Check for file drops (GLB files)
      const files = e.dataTransfer.files
      if (files.length > 0) {
        const file = files[0]
        if (file.name.toLowerCase().endsWith('.glb') || file.name.toLowerCase().endsWith('.gltf')) {
          const rect = this.el.getBoundingClientRect()
          const x = ((e.clientX - rect.left) / rect.width) * 2 - 1
          const y = -((e.clientY - rect.top) / rect.height) * 2 + 1
          
          this.loadGLBFile(file, x, y)
        }
      }
    })
  },

  addComponent(type, x, y) {
    const raycaster = new this.THREE.Raycaster()
    const mouse = new this.THREE.Vector2(x, y)
    raycaster.setFromCamera(mouse, this.camera)
    
    const floorPlane = new this.THREE.Plane(new this.THREE.Vector3(0, 1, 0), 0)
    const intersectPoint = new this.THREE.Vector3()
    raycaster.ray.intersectPlane(floorPlane, intersectPoint)
    
    let object
    const id = Date.now()
    
    switch(type) {
      case 'cube':
        object = this.createCube(intersectPoint, id)
        break
      case 'sphere':
        object = this.createSphere(intersectPoint, id)
        break
      default:
        return
    }
    
    this.scene.add(object)
    this.objects.push(object)
    
    this.pushEvent('component_added', {
      type,
      x: intersectPoint.x,
      y: intersectPoint.y,
      z: intersectPoint.z,
      id: id.toString()
    })
  },

  createCube(position, id) {
    const geometry = new this.THREE.BoxGeometry(0.5, 0.5, 0.5)
    const material = new this.THREE.MeshPhongMaterial({ color: 0x00ff00 })
    const cube = new this.THREE.Mesh(geometry, material)
    
    cube.position.copy(position)
    cube.position.y = 0.25
    cube.castShadow = true
    cube.receiveShadow = true
    
    cube.userData = {
      type: 'cube',
      id: id
    }
    
    return cube
  },

  createSphere(position, id) {
    const geometry = new this.THREE.SphereGeometry(0.3, 32, 16)
    const material = new this.THREE.MeshPhongMaterial({ color: 0x0066ff })
    const sphere = new this.THREE.Mesh(geometry, material)
    
    sphere.position.copy(position)
    sphere.position.y = 0.3
    sphere.castShadow = true
    sphere.receiveShadow = true
    
    sphere.userData = {
      type: 'sphere',
      id: id
    }
    
    return sphere
  },

  loadGLBFile(file, x, y) {
    console.log('Loading GLB file:', file.name)
    
    const reader = new FileReader()
    reader.onload = (event) => {
      const arrayBuffer = event.target.result
      
      this.gltfLoader.parse(arrayBuffer, '', (gltf) => {
        console.log('GLB loaded successfully')
        
        const model = gltf.scene
        const id = Date.now()
        
        // Calculate drop position
        const raycaster = new this.THREE.Raycaster()
        const mouse = new this.THREE.Vector2(x, y)
        raycaster.setFromCamera(mouse, this.camera)
        
        const floorPlane = new this.THREE.Plane(new this.THREE.Vector3(0, 1, 0), 0)
        const intersectPoint = new this.THREE.Vector3()
        raycaster.ray.intersectPlane(floorPlane, intersectPoint)
        
        // Position the model
        model.position.copy(intersectPoint)
        
        // Scale model to reasonable size (adjust as needed)
        const box = new this.THREE.Box3().setFromObject(model)
        const size = box.getSize(new this.THREE.Vector3())
        const maxSize = Math.max(size.x, size.y, size.z)
        if (maxSize > 2) {
          const scale = 2 / maxSize
          model.scale.setScalar(scale)
        }
        
        // Enable shadows
        model.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true
            child.receiveShadow = true
          }
        })
        
        // Set userData
        model.userData = {
          type: 'glb_model',
          id: id,
          filename: file.name
        }
        
        // Add to scene and objects array
        this.scene.add(model)
        this.objects.push(model)
        
        console.log('GLB model added to scene')
        
      }, (error) => {
        console.error('Error loading GLB:', error)
      })
    }
    
    reader.readAsArrayBuffer(file)
  },

  animate() {
    requestAnimationFrame(this.animate.bind(this))
    
    this.controls.update()
    
    // Update selection helper position if object moved
    if (this.selectedObject && this.selectionHelper) {
      const box = new this.THREE.Box3().setFromObject(this.selectedObject)
      this.selectionHelper.box = box
    }
    
    
    this.renderer.render(this.scene, this.camera)
  },


  setupResize() {
    const resizeObserver = new ResizeObserver(() => {
      this.camera.aspect = this.el.clientWidth / this.el.clientHeight
      this.camera.updateProjectionMatrix()
      this.renderer.setSize(this.el.clientWidth, this.el.clientHeight)
    })
    resizeObserver.observe(this.el)
  },

  destroyed() {
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
  }
}

export default ShowcaseRoom