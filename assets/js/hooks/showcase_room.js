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
    this.handleEvent("update_component_position", ({id, axis, value}) => {
      const object = this.objects.find(obj => obj.userData.id == id)
      if (object) {
        object.position[axis] = parseFloat(value)
        
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
      if (object && object.material) {
        object.material.color.set(color)
      }
    })
    
    // Handle scene state request for saving
    this.handleEvent("request_scene_state", () => {
      const sceneState = this.getCompleteSceneState()
      this.pushEvent("scene_state_ready", sceneState)
    })
    
    // Handle loading a saved scene
    this.handleEvent("load_scene", ({objects, scene_config, camera_state, lighting_config}) => {
      this.loadScene(objects, scene_config, camera_state, lighting_config)
    })
  },

  initThree() {
    // Get scene config from Phoenix
    const sceneConfig = JSON.parse(this.el.dataset.sceneConfig || '{}')
    
    Promise.all([
      import('three'),
      import('three/examples/jsm/controls/OrbitControls.js'),
      import('three/examples/jsm/controls/TransformControls.js')
    ]).then(([THREE, OrbitControlsModule, TransformControlsModule]) => {
      console.log('Modules loaded:', { THREE, OrbitControlsModule, TransformControlsModule })
      
      this.THREE = THREE
      const { OrbitControls } = OrbitControlsModule
      const { TransformControls } = TransformControlsModule
      
      const container = this.el
      
      // Scene - controlled by Phoenix config
      const scene = new THREE.Scene()
      scene.background = new THREE.Color(sceneConfig.background_color || '#1a1a1a')
      
      // Camera
      const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000)
      camera.position.set(10, 10, 10)
      camera.lookAt(0, 0, 0)
      
      // Renderer
      const renderer = new THREE.WebGLRenderer({ antialias: true })
      renderer.setSize(container.clientWidth, container.clientHeight)
      container.appendChild(renderer.domElement)
      
      // Create scene elements from Phoenix config
      this.createSceneElements(THREE, scene, sceneConfig)
      
      // Lighting
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.4)
      scene.add(ambientLight)
      
      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6)
      directionalLight.position.set(5, 8, 5)
      directionalLight.castShadow = true
      scene.add(directionalLight)
      
      // Controls
      const controls = new OrbitControls(camera, renderer.domElement)
      controls.enableDamping = true
      controls.dampingFactor = 0.05
      controls.minDistance = 1
      controls.maxDistance = 100
      
      // Transform Controls
      const transformControls = new TransformControls(camera, renderer.domElement)
      transformControls.addEventListener('change', () => {
        if (this.selectionHelper && this.selectedObject) {
          const box = new THREE.Box3().setFromObject(this.selectedObject)
          this.selectionHelper.box = box
        }
      })
      
      transformControls.addEventListener('dragging-changed', (event) => {
        controls.enabled = !event.value
      })
      
      scene.add(transformControls)
      
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
      
      // Handle resize
      const resizeObserver = new ResizeObserver(() => {
        camera.aspect = container.clientWidth / container.clientHeight
        camera.updateProjectionMatrix()
        renderer.setSize(container.clientWidth, container.clientHeight)
      })
      resizeObserver.observe(container)
      
      // Listen for drop events
      this.setupDropZone()
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
    const material = new this.THREE.MeshPhongMaterial({ color: 0x00ff00 })
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
    const material = new this.THREE.MeshPhongMaterial({ color: 0x0066ff })
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
      
      // Only check objects in this.objects array (cubes and spheres)
      const intersects = this.raycaster.intersectObjects(this.objects, false)
      
      if (intersects.length > 0) {
        const selectedObject = intersects[0].object
        // Only select cubes and spheres - they have type in userData
        if (selectedObject.userData && (selectedObject.userData.type === 'cube' || selectedObject.userData.type === 'sphere')) {
          this.selectObject(selectedObject)
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
    
    // Attach transform controls
    if (this.transformControls) {
      this.transformControls.attach(object)
    }
    
    // Notify Phoenix about selection
    this.pushEvent("component_selected", {
      id: object.userData.id,
      type: object.userData.type,
      position: {
        x: object.position.x,
        y: object.position.y,
        z: object.position.z
      },
      color: object.material.color ? '#' + object.material.color.getHexString() : '#00ff00'
    })
    
    // Visual feedback - only for cubes and spheres
    if (object.userData.type === 'cube' || object.userData.type === 'sphere') {
      // Store original color
      if (!object.userData.originalColor) {
        object.userData.originalColor = object.material.color.getHex()
      }
      // Highlight with emissive
      object.material.emissive = new this.THREE.Color(0xffffff)
      object.material.emissiveIntensity = 0.3
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
      
      // Detach transform controls
      if (this.transformControls) {
        this.transformControls.detach()
      }
      
      console.log('Scene children after removing selection helper:', this.scene.children.length)
      console.log('Grid helpers after removing selection helper:', this.scene.children.filter(c => c.type === 'GridHelper').length)
      
      // Reset visual feedback - only for cubes and spheres
      if (this.selectedObject.userData.type === 'cube' || this.selectedObject.userData.type === 'sphere') {
        // Reset emissive
        this.selectedObject.material.emissive = new this.THREE.Color(0x000000)
        this.selectedObject.material.emissiveIntensity = 0
      }
      
      this.selectedObject = null
    }
  },
  
  deleteSelectedObject() {
    if (!this.selectedObject) return
    
    // Only delete cubes and spheres
    if (this.selectedObject.userData.type !== 'cube' && this.selectedObject.userData.type !== 'sphere') {
      console.warn("Cannot delete this type of object:", this.selectedObject.userData.type)
      return
    }
    
    console.log("Deleting object:", this.selectedObject.userData.type)
    
    // Remove from scene
    this.scene.remove(this.selectedObject)
    
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
    
    // Listen for shift key to change drag mode
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Shift' && isDragging) {
        dragMode = 'vertical'
        updateDragPlane()
      }
    })
    
    window.addEventListener('keyup', (event) => {
      if (event.key === 'Shift' && isDragging) {
        dragMode = 'horizontal'
        updateDragPlane()
      }
    })
    
    const updateDragPlane = () => {
      if (!this.selectedObject) return
      
      if (dragMode === 'horizontal') {
        // Horizontal plane at object's Y position
        dragPlane.setFromNormalAndCoplanarPoint(
          new this.THREE.Vector3(0, 1, 0),
          this.selectedObject.position
        )
      } else {
        // Vertical plane facing camera
        const cameraDirection = new this.THREE.Vector3()
        this.camera.getWorldDirection(cameraDirection)
        cameraDirection.y = 0
        cameraDirection.normalize()
        dragPlane.setFromNormalAndCoplanarPoint(
          cameraDirection,
          this.selectedObject.position
        )
      }
    }
    
    this.renderer.domElement.addEventListener('mousedown', (event) => {
      if (this.selectedObject && event.button === 0) { // Left button
        isDragging = true
        this.controls.enabled = false
        
        // Set initial drag plane
        updateDragPlane()
        
        // Calculate offset
        const rect = this.renderer.domElement.getBoundingClientRect()
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
        
        this.raycaster.setFromCamera(this.mouse, this.camera)
        if (this.raycaster.ray.intersectPlane(dragPlane, intersection)) {
          offset.copy(intersection).sub(this.selectedObject.position)
        }
      }
    })
    
    this.renderer.domElement.addEventListener('mousemove', (event) => {
      if (isDragging && this.selectedObject) {
        const rect = this.renderer.domElement.getBoundingClientRect()
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
        
        this.raycaster.setFromCamera(this.mouse, this.camera)
        
        if (this.raycaster.ray.intersectPlane(dragPlane, intersection)) {
          const newPosition = intersection.sub(offset)
          
          if (dragMode === 'horizontal') {
            // Keep Y constant when dragging horizontally
            newPosition.y = this.selectedObject.position.y
          }
          
          this.selectedObject.position.copy(newPosition)
          
          // Update selection helper
          if (this.selectionHelper) {
            const box = new this.THREE.Box3().setFromObject(this.selectedObject)
            this.selectionHelper.box = box
          }
        }
      }
    })
    
    this.renderer.domElement.addEventListener('mouseup', () => {
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
    // Clear existing objects
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
        this.gridHelper.geometry.dispose()
        this.gridHelper.material.dispose()
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
    if (this.transformControls) {
      this.transformControls.setMode(mode)
      console.log(`Transform mode: ${mode}`)
      
      // Show visual feedback
      const modeText = mode === 'translate' ? 'Move (W)' : mode === 'rotate' ? 'Rotate (E)' : 'Scale (R)'
      this.updateHelpText(modeText)
    }
  },
  
  toggleTransformSpace() {
    if (this.transformControls) {
      const currentSpace = this.transformControls.space
      this.transformControls.setSpace(currentSpace === 'local' ? 'world' : 'local')
      console.log(`Transform space: ${this.transformControls.space}`)
      
      // Show visual feedback
      this.updateHelpText(`Space: ${this.transformControls.space.toUpperCase()}`)
    }
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

  getCompleteSceneState() {
    // Collect all object states
    const objects = this.objects.map(obj => ({
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
      color: obj.material && obj.material.color ? '#' + obj.material.color.getHexString() : '#ffffff',
      rotating: obj.userData.rotating || false,
      rotationSpeedX: obj.userData.rotationSpeedX || 0.01,
      rotationSpeedY: obj.userData.rotationSpeedY || 0.01
    }))
    
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
  
}

export default ShowcaseRoom