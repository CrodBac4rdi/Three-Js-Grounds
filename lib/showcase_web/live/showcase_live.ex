defmodule ShowcaseWeb.ShowcaseLive do
  use ShowcaseWeb, :live_view
  
  alias Showcase.Modeling
  alias Showcase.Accounts

  def mount(_params, session, socket) do
    socket = 
      socket
      |> assign_current_user(session)
      |> assign(:message, "Hello Showcase")
      |> assign(:components, %{})
      |> assign(:grid_size, 20)
      |> assign(:grid_divisions, 20)
      |> assign(:models, [])
      |> assign(:selected_component, nil)
      |> assign(:scene_config, %{
        background_color: "#2a2a2a",
        grid_visible: true,
        grid_size: 20,
        grid_divisions: 20
      })
      |> assign(:lights, %{
        ambient: true,
        key: true,
        fill: true,
        rim: true,
        spot: true,
        rail: true
      })
      |> assign(:exposure, 1.0)
      |> assign(:show_parametric_dialog, false)
      |> assign(:parametric_shape, nil)
      |> assign(:parametric_params, %{})
      |> assign(:transform_mode, "translate")
      |> assign(:transform_space, "world")
    
    # Always load models, not just for logged-in users
    {:ok, load_all_models(socket)}
  end
  
  defp assign_current_user(socket, session) do
    case session do
      %{"user_token" => user_token} ->
        assign_new(socket, :current_user, fn ->
          Accounts.get_user_by_session_token(user_token)
        end)
      _ ->
        assign(socket, :current_user, nil)
    end
  end
  
  
  defp load_all_models(socket) do
    models = Modeling.list_models()
    IO.inspect(models, label: "Loaded models")
    IO.puts("Number of models: #{length(models)}")
    assign(socket, :models, models)
  end

  def render(assigns) do
    ~H"""
    <div class="h-screen bg-gray-900 flex flex-col overflow-hidden">
      <!-- Lighting Toolbar -->
      <div class="bg-gray-800 shadow-md px-4 py-2 flex items-center space-x-4 border-b border-gray-700">
        <h3 class="font-semibold text-gray-300 mr-4">Lighting:</h3>
        
        <button 
          phx-click="toggle_light" 
          phx-value-type="ambient"
          class={"px-3 py-1 rounded transition-colors " <> if(@lights.ambient, do: "bg-blue-500 text-white", else: "bg-gray-300 text-gray-700")}
        >
          Ambient
        </button>
        
        <button 
          phx-click="toggle_light" 
          phx-value-type="key"
          class={"px-3 py-1 rounded transition-colors " <> if(@lights.key, do: "bg-blue-500 text-white", else: "bg-gray-300 text-gray-700")}
        >
          Key Light
        </button>
        
        <button 
          phx-click="toggle_light" 
          phx-value-type="fill"
          class={"px-3 py-1 rounded transition-colors " <> if(@lights.fill, do: "bg-blue-500 text-white", else: "bg-gray-300 text-gray-700")}
        >
          Fill Light
        </button>
        
        <button 
          phx-click="toggle_light" 
          phx-value-type="rim"
          class={"px-3 py-1 rounded transition-colors " <> if(@lights.rim, do: "bg-blue-500 text-white", else: "bg-gray-300 text-gray-700")}
        >
          Rim Light
        </button>
        
        <button 
          phx-click="toggle_light" 
          phx-value-type="spot"
          class={"px-3 py-1 rounded transition-colors " <> if(@lights.spot, do: "bg-blue-500 text-white", else: "bg-gray-300 text-gray-700")}
        >
          Spotlight
        </button>
        
        <button 
          phx-click="toggle_rail_light" 
          class={"px-3 py-1 rounded transition-colors " <> if(Map.get(@lights, :rail, true), do: "bg-blue-500 text-white", else: "bg-gray-300 text-gray-700")}
          title="Draggable light on rail - select and drag to move"
        >
          Rail Light
        </button>
        
        <div class="ml-auto flex items-center space-x-4">
          <!-- Transform Mode Buttons -->
          <div class="flex items-center space-x-2">
            <button 
              phx-click="set_transform_mode" 
              phx-value-mode="translate"
              class={"w-8 h-8 rounded text-white flex items-center justify-center transition-colors " <> if(@transform_mode == "translate", do: "bg-blue-600", else: "bg-gray-700 hover:bg-gray-600")}
              title="Move (W)"
            >
              W
            </button>
            <button 
              phx-click="set_transform_mode" 
              phx-value-mode="rotate"
              class={"w-8 h-8 rounded text-white flex items-center justify-center transition-colors " <> if(@transform_mode == "rotate", do: "bg-blue-600", else: "bg-gray-700 hover:bg-gray-600")}
              title="Rotate (E)"
            >
              E
            </button>
            <button 
              phx-click="set_transform_mode" 
              phx-value-mode="scale"
              class={"w-8 h-8 rounded text-white flex items-center justify-center transition-colors " <> if(@transform_mode == "scale", do: "bg-blue-600", else: "bg-gray-700 hover:bg-gray-600")}
              title="Scale (R)"
            >
              R
            </button>
            <button 
              phx-click="toggle_transform_space"
              class="w-8 h-8 rounded bg-gray-700 hover:bg-gray-600 text-white flex items-center justify-center transition-colors"
              title="Toggle Local/World Space (Q)"
            >
              Q
            </button>
          </div>
          
          <!-- Exposure Control -->
          <form class="flex items-center space-x-2" phx-change="adjust_exposure">
            <label class="text-sm text-gray-400">Exposure:</label>
            <input 
              type="range" 
              name="value"
              min="0.5" 
              max="2" 
              step="0.1" 
              value={@exposure}
              class="w-32"
            />
            <span class="text-sm text-gray-300"><%= @exposure %></span>
          </form>
        </div>
      </div>
      
      <div class="flex-1 relative overflow-hidden">
        <!-- Main Content - 3D Scene -->
        <div 
          id="showcase-room-container" 
          phx-hook="ShowcaseRoom"
          phx-update="ignore"
          data-scene-config={Jason.encode!(@scene_config)}
          data-light-config={Jason.encode!(@lights)}
          class="absolute inset-0 bg-gray-900"
        >
        </div>
        
        <!-- GUI Sidebar - Overlayed -->
        <div class="absolute left-0 top-0 bottom-0 w-64 bg-gray-800 bg-opacity-90 shadow-lg flex flex-col z-10">
          <div class="p-4 border-b border-gray-700">
          <h2 class="text-white font-bold text-lg">Components</h2>
          <button 
            phx-click="save_scene"
            class="mt-2 w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
          >
            Save Scene
          </button>
          
          <button 
            phx-click="export_scene"
            class="mt-2 w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded transition-colors"
          >
            Export as GLB
          </button>
        </div>
        <div class="flex-1 overflow-y-auto p-4">
          <!-- Basic Shapes -->
          <h3 class="text-white font-bold mb-2">Basic Shapes</h3>
          <div class="space-y-2 mb-4">
            <div 
              id="component-cube"
              draggable="true"
              data-component-type="cube"
              phx-hook="DraggableComponent"
              class="bg-gray-700 rounded p-3 cursor-move hover:bg-gray-600 transition-colors"
            >
              <div class="text-white text-sm font-medium">Cube</div>
              <div class="text-gray-400 text-xs">Basic 3D cube</div>
            </div>
            <div 
              id="component-sphere"
              draggable="true"
              data-component-type="sphere"
              phx-hook="DraggableComponent"
              class="bg-gray-700 rounded p-3 cursor-move hover:bg-gray-600 transition-colors"
            >
              <div class="text-white text-sm font-medium">Sphere</div>
              <div class="text-gray-400 text-xs">3D sphere</div>
            </div>
          </div>
          
          <!-- Parametric Shapes -->
          <h3 class="text-white font-bold mb-2">Parametric Shapes</h3>
          <div class="space-y-2">
            <button 
              phx-click="show_parametric_dialog"
              phx-value-shape="box"
              class="w-full bg-blue-600 hover:bg-blue-700 text-white rounded p-2 text-sm transition-colors"
            >
              Parametric Box
            </button>
            <button 
              phx-click="show_parametric_dialog"
              phx-value-shape="cylinder"
              class="w-full bg-blue-600 hover:bg-blue-700 text-white rounded p-2 text-sm transition-colors"
            >
              Parametric Cylinder
            </button>
            <button 
              phx-click="show_parametric_dialog"
              phx-value-shape="torus"
              class="w-full bg-blue-600 hover:bg-blue-700 text-white rounded p-2 text-sm transition-colors"
            >
              Parametric Torus
            </button>
            <button 
              phx-click="show_parametric_dialog"
              phx-value-shape="cone"
              class="w-full bg-blue-600 hover:bg-blue-700 text-white rounded p-2 text-sm transition-colors"
            >
              Parametric Cone
            </button>
            <button 
              phx-click="show_parametric_dialog"
              phx-value-shape="plane"
              class="w-full bg-blue-600 hover:bg-blue-700 text-white rounded p-2 text-sm transition-colors"
            >
              Parametric Plane
            </button>
          </div>
          
          <!-- Saved Scenes -->
          <div class="mt-6">
            <h3 class="text-white font-bold mb-2">Saved Scenes</h3>
            <div class="space-y-2 max-h-48 overflow-y-auto">
              <%= for model <- @models do %>
                <div class="bg-gray-700 rounded p-2 hover:bg-gray-600 transition-colors relative group">
                  <div 
                    phx-click="load_scene"
                    phx-value-id={model.id}
                    class="cursor-pointer"
                  >
                    <div class="text-white text-sm"><%= model.name %></div>
                    <div class="text-gray-400 text-xs"><%= Calendar.strftime(model.inserted_at, "%Y-%m-%d %H:%M") %></div>
                  </div>
                  <button
                    phx-click="delete_scene"
                    phx-value-id={model.id}
                    class="absolute top-1 right-1 text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity"
                    data-confirm="Are you sure you want to delete this scene?"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                    </svg>
                  </button>
                </div>
              <% end %>
              <%= if @models == [] do %>
                <div class="text-gray-400 text-sm">No saved scenes yet</div>
              <% end %>
            </div>
          </div>
        </div>
        
        <!-- Properties Panel -->
        <%= if @selected_component do %>
          <div class="border-t border-gray-700 p-4">
            <h3 class="text-white font-bold mb-3">Properties</h3>
            <form phx-change="update_properties" class="space-y-3">
              <input type="hidden" name="component_id" value={@selected_component.id} />
              <div>
                <label class="text-gray-400 text-xs">Type</label>
                <div class="text-gray-300 text-sm"><%= @selected_component.type %></div>
              </div>
              <div>
                <label class="text-gray-400 text-xs">Position X</label>
                <input 
                  type="number" 
                  name="position_x"
                  value={@selected_component.position.x}
                  step="0.1"
                  class="w-full px-2 py-1 bg-gray-700 text-white rounded"
                />
              </div>
              <div>
                <label class="text-gray-400 text-xs">Position Y</label>
                <input 
                  type="number" 
                  name="position_y"
                  value={@selected_component.position.y}
                  step="0.1"
                  class="w-full px-2 py-1 bg-gray-700 text-white rounded"
                />
              </div>
              <div>
                <label class="text-gray-400 text-xs">Position Z</label>
                <input 
                  type="number" 
                  name="position_z"
                  value={@selected_component.position.z}
                  step="0.1"
                  class="w-full px-2 py-1 bg-gray-700 text-white rounded"
                />
              </div>
              <div>
                <label class="text-gray-400 text-xs">Color</label>
                <input 
                  type="color" 
                  name="color"
                  value={@selected_component.color || "#00ff00"}
                  class="w-full h-8 bg-gray-700 rounded cursor-pointer"
                />
              </div>
            </form>
            
            <%= if @selected_component.type == "glb" do %>
              <div class="mt-4 pt-4 border-t border-gray-700">
                <button 
                  phx-click="convert_to_mesh"
                  class="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 rounded transition-colors"
                >
                  Convert to Editable Mesh
                </button>
                <p class="text-gray-400 text-xs mt-2">
                  Break down this model into individual editable mesh parts
                </p>
              </div>
            <% end %>
          </div>
        <% end %>
        </div>
      </div>
      
      <!-- Parametric Shape Dialog -->
      <%= if @show_parametric_dialog do %>
        <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div class="bg-gray-800 rounded-lg p-6 w-96 max-h-[80vh] overflow-y-auto">
            <h2 class="text-white text-xl font-bold mb-4">
              Create Parametric <%= String.capitalize(@parametric_shape || "") %>
            </h2>
            
            <form phx-submit="create_parametric_shape" class="space-y-4">
              <input type="hidden" name="shape" value={@parametric_shape} />
              
              <%= case @parametric_shape do %>
                <% "box" -> %>
                  <div>
                    <label class="text-gray-300 text-sm">Width</label>
                    <input type="number" name="width" value="1" step="0.1" min="0.1" class="w-full px-3 py-2 bg-gray-700 text-white rounded" />
                  </div>
                  <div>
                    <label class="text-gray-300 text-sm">Height</label>
                    <input type="number" name="height" value="1" step="0.1" min="0.1" class="w-full px-3 py-2 bg-gray-700 text-white rounded" />
                  </div>
                  <div>
                    <label class="text-gray-300 text-sm">Depth</label>
                    <input type="number" name="depth" value="1" step="0.1" min="0.1" class="w-full px-3 py-2 bg-gray-700 text-white rounded" />
                  </div>
                  <div>
                    <label class="text-gray-300 text-sm">Width Segments</label>
                    <input type="number" name="widthSegments" value="1" min="1" max="50" class="w-full px-3 py-2 bg-gray-700 text-white rounded" />
                  </div>
                  <div>
                    <label class="text-gray-300 text-sm">Height Segments</label>
                    <input type="number" name="heightSegments" value="1" min="1" max="50" class="w-full px-3 py-2 bg-gray-700 text-white rounded" />
                  </div>
                  <div>
                    <label class="text-gray-300 text-sm">Depth Segments</label>
                    <input type="number" name="depthSegments" value="1" min="1" max="50" class="w-full px-3 py-2 bg-gray-700 text-white rounded" />
                  </div>
                  
                <% "cylinder" -> %>
                  <div>
                    <label class="text-gray-300 text-sm">Radius Top</label>
                    <input type="number" name="radiusTop" value="0.5" step="0.1" min="0" class="w-full px-3 py-2 bg-gray-700 text-white rounded" />
                  </div>
                  <div>
                    <label class="text-gray-300 text-sm">Radius Bottom</label>
                    <input type="number" name="radiusBottom" value="0.5" step="0.1" min="0" class="w-full px-3 py-2 bg-gray-700 text-white rounded" />
                  </div>
                  <div>
                    <label class="text-gray-300 text-sm">Height</label>
                    <input type="number" name="height" value="1" step="0.1" min="0.1" class="w-full px-3 py-2 bg-gray-700 text-white rounded" />
                  </div>
                  <div>
                    <label class="text-gray-300 text-sm">Radial Segments</label>
                    <input type="number" name="radialSegments" value="8" min="3" max="64" class="w-full px-3 py-2 bg-gray-700 text-white rounded" />
                  </div>
                  <div>
                    <label class="text-gray-300 text-sm">Height Segments</label>
                    <input type="number" name="heightSegments" value="1" min="1" max="50" class="w-full px-3 py-2 bg-gray-700 text-white rounded" />
                  </div>
                  
                <% "torus" -> %>
                  <div>
                    <label class="text-gray-300 text-sm">Radius</label>
                    <input type="number" name="radius" value="0.5" step="0.1" min="0.1" class="w-full px-3 py-2 bg-gray-700 text-white rounded" />
                  </div>
                  <div>
                    <label class="text-gray-300 text-sm">Tube Radius</label>
                    <input type="number" name="tube" value="0.2" step="0.05" min="0.01" class="w-full px-3 py-2 bg-gray-700 text-white rounded" />
                  </div>
                  <div>
                    <label class="text-gray-300 text-sm">Radial Segments</label>
                    <input type="number" name="radialSegments" value="8" min="3" max="64" class="w-full px-3 py-2 bg-gray-700 text-white rounded" />
                  </div>
                  <div>
                    <label class="text-gray-300 text-sm">Tubular Segments</label>
                    <input type="number" name="tubularSegments" value="16" min="3" max="64" class="w-full px-3 py-2 bg-gray-700 text-white rounded" />
                  </div>
                  
                <% "cone" -> %>
                  <div>
                    <label class="text-gray-300 text-sm">Radius</label>
                    <input type="number" name="radius" value="0.5" step="0.1" min="0.1" class="w-full px-3 py-2 bg-gray-700 text-white rounded" />
                  </div>
                  <div>
                    <label class="text-gray-300 text-sm">Height</label>
                    <input type="number" name="height" value="1" step="0.1" min="0.1" class="w-full px-3 py-2 bg-gray-700 text-white rounded" />
                  </div>
                  <div>
                    <label class="text-gray-300 text-sm">Radial Segments</label>
                    <input type="number" name="radialSegments" value="8" min="3" max="64" class="w-full px-3 py-2 bg-gray-700 text-white rounded" />
                  </div>
                  
                <% "plane" -> %>
                  <div>
                    <label class="text-gray-300 text-sm">Width</label>
                    <input type="number" name="width" value="2" step="0.1" min="0.1" class="w-full px-3 py-2 bg-gray-700 text-white rounded" />
                  </div>
                  <div>
                    <label class="text-gray-300 text-sm">Height</label>
                    <input type="number" name="height" value="2" step="0.1" min="0.1" class="w-full px-3 py-2 bg-gray-700 text-white rounded" />
                  </div>
                  <div>
                    <label class="text-gray-300 text-sm">Width Segments</label>
                    <input type="number" name="widthSegments" value="1" min="1" max="50" class="w-full px-3 py-2 bg-gray-700 text-white rounded" />
                  </div>
                  <div>
                    <label class="text-gray-300 text-sm">Height Segments</label>
                    <input type="number" name="heightSegments" value="1" min="1" max="50" class="w-full px-3 py-2 bg-gray-700 text-white rounded" />
                  </div>
                  
                <% _ -> %>
                  <div class="text-gray-400">Unknown shape type</div>
              <% end %>
              
              <div class="flex gap-2 mt-6">
                <button type="submit" class="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded transition-colors">
                  Create
                </button>
                <button type="button" phx-click="close_parametric_dialog" class="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 rounded transition-colors">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      <% end %>
    </div>
    """
  end

  def handle_event("component_added", %{"type" => type, "x" => x, "y" => y, "z" => z} = params, socket) do
    # Use the JavaScript-generated ID if provided, otherwise generate one
    component_id = case params do
      %{"id" => js_id} -> String.to_integer(js_id)
      _ -> System.unique_integer([:positive])
    end
    
    # Default properties based on type
    default_color = case type do
      "cube" -> "#00ff00"
      "sphere" -> "#0066ff"
      "parametric" -> "#4a90e2"
      "glb" -> "#808080"
      "mesh" -> "#808080"
      _ -> "#ffffff"
    end
    
    component = %{
      id: component_id,
      type: type,
      position: %{x: x, y: y, z: z},
      rotation: %{x: 0, y: 0, z: 0},
      scale: %{x: 1, y: 1, z: 1},
      color: Map.get(params, "color", default_color),
      rotating: Map.get(params, "rotating", true),
      rotationSpeedX: Map.get(params, "rotationSpeedX", 0.01),
      rotationSpeedY: Map.get(params, "rotationSpeedY", 0.01),
      filename: Map.get(params, "filename"),
      shape: Map.get(params, "shape"),
      params: Map.get(params, "params")
    }
    
    components = Map.put(socket.assigns.components, component_id, component)
    
    # Push the complete component data back to JS
    {:noreply, 
     socket
     |> assign(:components, components)
     |> push_event("component_created", component)
    }
  end

  def handle_event("component_selected", params, socket) do
    component = %{
      id: params["id"],
      type: params["type"],
      position: %{
        x: params["position"]["x"],
        y: params["position"]["y"],
        z: params["position"]["z"]
      },
      color: params["color"]
    }
    
    {:noreply, assign(socket, :selected_component, component)}
  end
  
  def handle_event("component_deselected", _params, socket) do
    {:noreply, assign(socket, :selected_component, nil)}
  end
  
  def handle_event("update_properties", %{"component_id" => component_id, "position_x" => x, "position_y" => y, "position_z" => z, "color" => color}, socket) do
    id = String.to_integer(component_id)
    
    # Parse position values
    {x_val, _} = Float.parse(x)
    {y_val, _} = Float.parse(y)
    {z_val, _} = Float.parse(z)
    
    # Update in components map
    updated_components = 
      Map.update!(socket.assigns.components, id, fn component ->
        component
        |> Map.put(:position, %{x: x_val, y: y_val, z: z_val})
        |> Map.put(:color, color)
      end)
    
    # Update selected component if it matches
    selected = 
      if socket.assigns.selected_component && socket.assigns.selected_component.id == id do
        socket.assigns.selected_component
        |> Map.put(:position, %{x: x_val, y: y_val, z: z_val})
        |> Map.put(:color, color)
      else
        socket.assigns.selected_component
      end
    
    # Push updates to Three.js
    socket = socket
    |> push_event("update_component_position", %{
      id: component_id,
      position: %{x: x_val, y: y_val, z: z_val}
    })
    |> push_event("update_component_color", %{
      id: component_id,
      color: color
    })
    
    {:noreply, 
     socket
     |> assign(:components, updated_components)
     |> assign(:selected_component, selected)
    }
  end

  def handle_event("save_scene", _params, socket) do
    IO.puts("Save scene event received")
    # Request current state from Three.js
    {:noreply, push_event(socket, "request_scene_state", %{})}
  end
  
  def handle_event("export_scene", _params, socket) do
    IO.puts("Export scene event received")
    # Request scene export from Three.js
    {:noreply, push_event(socket, "export_scene_as_glb", %{})}
  end
  
  def handle_event("delete_scene", %{"id" => id}, socket) do
    case Modeling.get_model!(id) do
      nil ->
        {:noreply, put_flash(socket, :error, "Scene not found")}
        
      model ->
        case Modeling.delete_model(model) do
          {:ok, _} ->
            {:noreply, 
             socket
             |> put_flash(:info, "Scene deleted successfully")
             |> load_all_models()
            }
          {:error, _} ->
            {:noreply, put_flash(socket, :error, "Failed to delete scene")}
        end
    end
  end
  
  def handle_event("toggle_light", %{"type" => light_type}, socket) do
    lights = socket.assigns.lights
    updated_lights = Map.put(lights, String.to_existing_atom(light_type), !lights[String.to_existing_atom(light_type)])
    
    {:noreply, 
     socket
     |> assign(:lights, updated_lights)
     |> push_event("toggle_light", %{type: light_type, enabled: updated_lights[String.to_existing_atom(light_type)]})
    }
  end
  
  def handle_event("toggle_rail_light", _params, socket) do
    lights = socket.assigns.lights
    rail_enabled = !Map.get(lights, :rail, true)
    updated_lights = Map.put(lights, :rail, rail_enabled)
    
    {:noreply, 
     socket
     |> assign(:lights, updated_lights)
     |> push_event("toggle_rail_light", %{enabled: rail_enabled})
    }
  end
  
  def handle_event("adjust_exposure", params, socket) do
    exposure = case params do
      %{"value" => value} when is_binary(value) -> 
        {parsed, _} = Float.parse(value)
        parsed
      %{"value" => value} when is_number(value) -> 
        value
      _ -> 
        1.0
    end
    
    {:noreply,
     socket
     |> assign(:exposure, exposure)
     |> push_event("adjust_exposure", %{value: exposure})
    }
  end
  
  def handle_event("scene_state_ready", %{"objects" => objects, "scene_config" => scene_config}, socket) do
    IO.puts("Scene state ready received")
    IO.inspect(objects, label: "Objects")
    IO.inspect(scene_config, label: "Scene config")
    
    # Convert JS objects to our component format with string keys
    components = Enum.reduce(objects, %{}, fn obj, acc ->
      component = %{
        "id" => obj["id"],
        "type" => obj["type"],
        "position" => %{
          "x" => obj["position"]["x"],
          "y" => obj["position"]["y"],
          "z" => obj["position"]["z"]
        },
        "rotation" => %{
          "x" => obj["rotation"]["x"],
          "y" => obj["rotation"]["y"],
          "z" => obj["rotation"]["z"]
        },
        "scale" => %{
          "x" => obj["scale"]["x"],
          "y" => obj["scale"]["y"],
          "z" => obj["scale"]["z"]
        },
        "color" => obj["color"],
        "rotating" => obj["rotating"],
        "rotationSpeedX" => obj["rotationSpeedX"],
        "rotationSpeedY" => obj["rotationSpeedY"],
        "filename" => obj["filename"]
      }
      Map.put(acc, to_string(obj["id"]), component)
    end)
    
    model_data = %{
      "components" => components,
      "scene_config" => scene_config,
      "camera_state" => Map.get(scene_config, "camera", %{}),
      "lighting_config" => Map.get(scene_config, "lighting", %{})
    }
    
    # Save without user_id for now
    attrs = %{
      user_id: socket.assigns.current_user && socket.assigns.current_user.id || nil,
      name: "Scene #{DateTime.utc_now() |> Calendar.strftime("%Y-%m-%d %H:%M")}",
      data: model_data
    }
    
    IO.inspect(attrs, label: "Model attrs to save")
    
    case Modeling.create_model(attrs) do
      {:ok, _model} ->
        IO.puts("Model saved successfully")
        {:noreply, 
         socket
         |> put_flash(:info, "Scene saved successfully!")
         |> load_all_models()
        }
      
      {:error, changeset} ->
        IO.puts("Failed to save model")
        IO.inspect(changeset, label: "Changeset errors")
        {:noreply, put_flash(socket, :error, "Failed to save scene")}
    end
  end
  
  def handle_event("load_scene", %{"id" => id}, socket) do
    case Modeling.get_model!(id) do
      nil ->
        {:noreply, put_flash(socket, :error, "Scene not found")}
        
      model ->
        # Load the scene data
        socket = 
          socket
          |> assign(:components, model.data["components"] || %{})
          |> assign(:scene_config, model.data["scene_config"] || %{
            background_color: "#1a1a1a",
            grid_visible: true,
            grid_size: 20,
            grid_divisions: 20
          })
          |> push_event("load_scene", %{
            objects: Map.values(model.data["components"] || %{}),
            scene_config: model.data["scene_config"] || %{},
            camera_state: model.data["camera_state"] || %{},
            lighting_config: model.data["lighting_config"] || %{}
          })
        
        {:noreply, put_flash(socket, :info, "Scene loaded: #{model.name}")}
    end
  end
  
  def handle_event("update_component", %{"id" => id, "position" => position, "rotation" => rotation, "scale" => scale}, socket) do
    component_id = if is_binary(id), do: String.to_integer(id), else: id
    
    # Only update if component exists
    if Map.has_key?(socket.assigns.components, component_id) do
      # Update component in state
      updated_components = 
        Map.update!(socket.assigns.components, component_id, fn component ->
          component
          |> Map.put(:position, %{
            x: position["x"],
            y: position["y"],
            z: position["z"]
          })
          |> Map.put(:rotation, %{
            x: rotation["x"],
            y: rotation["y"],
            z: rotation["z"]
          })
          |> Map.put(:scale, %{
            x: scale["x"],
            y: scale["y"],
            z: scale["z"]
          })
        end)
      
      # Update selected component if it matches
      selected = 
        if socket.assigns.selected_component && socket.assigns.selected_component.id == component_id do
          Map.merge(socket.assigns.selected_component, %{
            position: %{
              x: position["x"],
              y: position["y"],
              z: position["z"]
            }
          })
        else
          socket.assigns.selected_component
        end
      
      {:noreply, 
       socket
       |> assign(:components, updated_components)
       |> assign(:selected_component, selected)
      }
    else
      {:noreply, socket}
    end
  end
  
  def handle_event("show_parametric_dialog", %{"shape" => shape}, socket) do
    {:noreply, 
     socket
     |> assign(:show_parametric_dialog, true)
     |> assign(:parametric_shape, shape)
    }
  end
  
  def handle_event("close_parametric_dialog", _params, socket) do
    {:noreply, 
     socket
     |> assign(:show_parametric_dialog, false)
     |> assign(:parametric_shape, nil)
    }
  end
  
  def handle_event("create_parametric_shape", params, socket) do
    # Parse numeric values
    parsed_params = Enum.reduce(params, %{}, fn {key, value}, acc ->
      case Float.parse(value) do
        {num, _} -> Map.put(acc, key, num)
        :error -> Map.put(acc, key, value)
      end
    end)
    
    # Send to JavaScript to create the parametric shape
    {:noreply, 
     socket
     |> push_event("create_parametric_shape", parsed_params)
     |> assign(:show_parametric_dialog, false)
     |> assign(:parametric_shape, nil)
    }
  end
  
  def handle_event("convert_to_mesh", _params, socket) do
    if socket.assigns.selected_component && socket.assigns.selected_component.type == "glb" do
      {:noreply, push_event(socket, "convert_to_mesh", %{id: socket.assigns.selected_component.id})}
    else
      {:noreply, socket}
    end
  end
  
  def handle_event("set_transform_mode", %{"mode" => mode}, socket) do
    {:noreply, 
     socket
     |> assign(:transform_mode, mode)
     |> push_event("set_transform_mode", %{mode: mode})
    }
  end
  
  def handle_event("toggle_transform_space", _params, socket) do
    new_space = if socket.assigns.transform_space == "world", do: "local", else: "world"
    {:noreply, 
     socket
     |> assign(:transform_space, new_space)
     |> push_event("toggle_transform_space", %{})
    }
  end

end