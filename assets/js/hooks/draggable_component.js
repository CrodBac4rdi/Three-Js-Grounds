const DraggableComponent = {
  mounted() {
    this.el.addEventListener('dragstart', (e) => {
      const componentType = this.el.dataset.componentType
      e.dataTransfer.setData('component-type', componentType)
      e.dataTransfer.effectAllowed = 'copy'
      
      // Visual feedback
      this.el.style.opacity = '0.5'
    })
    
    this.el.addEventListener('dragend', (e) => {
      this.el.style.opacity = ''
    })
  }
}

export default DraggableComponent