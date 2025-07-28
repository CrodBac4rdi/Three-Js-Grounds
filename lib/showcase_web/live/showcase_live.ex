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
        background_color: "#1a1a1a",
        grid_visible: true,
        grid_size: 20,
        grid_divisions: 20
      })
    
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
  
  defp load_user_models(socket) do
    models = Modeling.list_models_by_user(socket.assigns.current_user.id)
    assign(socket, :models, models)
  end
  
  defp load_all_models(socket) do
    models = Modeling.list_models()
    assign(socket, :models, models)
  end

  def render(assigns) do
    ~H"""
    <div class="min-h-screen bg-blue-900 flex">
      <!-- GUI Sidebar -->
      <div class="w-64 bg-blue-800 shadow-lg flex flex-col">
        <div class="p-4 border-b border-blue-700">
          <h2 class="text-white font-bold text-lg">Components</h2>
          <button 
            phx-click="save_scene"
            class="mt-2 w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
          >
            Save Scene
          </button>
        </div>
        <div class="flex-1 overflow-y-auto p-4">
          <div class="space-y-2">
            <div 
              id="component-cube"
              draggable="true"
              data-component-type="cube"
              phx-hook="DraggableComponent"
              class="bg-blue-700 rounded p-3 cursor-move hover:bg-blue-600 transition-colors"
            >
              <div class="text-white text-sm font-medium">Cube</div>
              <div class="text-blue-200 text-xs">Basic 3D cube</div>
            </div>
            <div 
              id="component-sphere"
              draggable="true"
              data-component-type="sphere"
              phx-hook="DraggableComponent"
              class="bg-blue-700 rounded p-3 cursor-move hover:bg-blue-600 transition-colors"
            >
              <div class="text-white text-sm font-medium">Sphere</div>
              <div class="text-blue-200 text-xs">3D sphere</div>
            </div>
          </div>
          
          <!-- Saved Scenes -->
          <div class="mt-6">
            <h3 class="text-white font-bold mb-2">Saved Scenes</h3>
            <div class="space-y-2 max-h-48 overflow-y-auto">
              <%= for model <- @models do %>
                <div 
                  phx-click="load_scene"
                  phx-value-id={model.id}
                  class="bg-blue-700 rounded p-2 cursor-pointer hover:bg-blue-600 transition-colors"
                >
                  <div class="text-white text-sm"><%= model.name %></div>
                  <div class="text-blue-200 text-xs"><%= Calendar.strftime(model.inserted_at, "%Y-%m-%d %H:%M") %></div>
                </div>
              <% end %>
              <%= if @models == [] do %>
                <div class="text-blue-200 text-sm">No saved scenes yet</div>
              <% end %>
            </div>
          </div>
        </div>
        
        <!-- Properties Panel -->
        <%= if @selected_component do %>
          <div class="border-t border-blue-700 p-4">
            <h3 class="text-white font-bold mb-3">Properties</h3>
            <div class="space-y-3">
              <div>
                <label class="text-blue-200 text-xs">Position X</label>
                <input 
                  type="number" 
                  value={@selected_component.position.x}
                  phx-change="update_position"
                  phx-value-axis="x"
                  phx-value-component-id={@selected_component.id}
                  step="0.1"
                  class="w-full px-2 py-1 bg-blue-900 text-white rounded"
                />
              </div>
              <div>
                <label class="text-blue-200 text-xs">Position Y</label>
                <input 
                  type="number" 
                  value={@selected_component.position.y}
                  phx-change="update_position"
                  phx-value-axis="y"
                  phx-value-component-id={@selected_component.id}
                  step="0.1"
                  class="w-full px-2 py-1 bg-blue-900 text-white rounded"
                />
              </div>
              <div>
                <label class="text-blue-200 text-xs">Position Z</label>
                <input 
                  type="number" 
                  value={@selected_component.position.z}
                  phx-change="update_position"
                  phx-value-axis="z"
                  phx-value-component-id={@selected_component.id}
                  step="0.1"
                  class="w-full px-2 py-1 bg-blue-900 text-white rounded"
                />
              </div>
              <div>
                <label class="text-blue-200 text-xs">Color</label>
                <input 
                  type="color" 
                  value={@selected_component.color || "#00ff00"}
                  phx-change="update_color"
                  phx-value-component-id={@selected_component.id}
                  class="w-full h-8 bg-blue-900 rounded cursor-pointer"
                />
              </div>
            </div>
          </div>
        <% end %>
      </div>

      <!-- Main Content -->
      <div class="flex-1 flex flex-col">
        <nav class="bg-blue-800 shadow-lg">
          <div class="px-4 sm:px-6 lg:px-8">
            <div class="flex justify-between h-16">
              <div class="flex items-center">
                <a href="/" class="text-white font-bold text-xl">
                  3D Showcase
                </a>
              </div>
              <div class="flex items-center space-x-4">
                <%= if @current_user do %>
                  <span class="text-white">Hello, <%= @current_user.email %>!</span>
                  <.link href="/users/log_out" method="delete" class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors">
                    Logout
                  </.link>
                <% else %>
                  <.link href="/users/log_in" class="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded transition-colors">
                    Login
                  </.link>
                  <.link href="/users/register" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors">
                    Register
                  </.link>
                <% end %>
              </div>
            </div>
          </div>
        </nav>
        
        
        <div class="flex-1 p-4 relative">
          <div 
            id="showcase-room-container" 
            phx-hook="ShowcaseRoom"
            phx-update="ignore"
            class="w-full h-full bg-gray-900 rounded-lg"
          >
          </div>
          
          <!-- Help text -->
          <div class="absolute bottom-4 left-4 bg-black bg-opacity-50 text-white text-xs p-2 rounded">
            <div>Click: Select | W: Move | E: Rotate | R: Scale | Q: Toggle Local/World | Delete: Remove</div>
            <div>Scroll: Zoom | Right-drag: Orbit camera | Drag GLB files to load models</div>
          </div>
        </div>
      </div>
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
      _ -> "#ffffff"
    end
    
    component = %{
      id: component_id,
      type: type,
      position: %{x: x, y: y, z: z},
      rotation: %{x: 0, y: 0, z: 0},
      scale: %{x: 1, y: 1, z: 1},
      color: default_color,
      rotating: Map.get(params, "rotating", true),
      rotationSpeedX: Map.get(params, "rotationSpeedX", 0.01),
      rotationSpeedY: Map.get(params, "rotationSpeedY", 0.01)
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
  
  def handle_event("update_position", %{"axis" => axis, "component-id" => component_id, "value" => value}, socket) do
    {value, _} = Float.parse(value)
    
    # Update in components map
    updated_components = 
      Map.update!(socket.assigns.components, String.to_integer(component_id), fn component ->
        put_in(component, [:position, String.to_atom(axis)], value)
      end)
    
    # Update selected component if it matches
    selected = 
      if socket.assigns.selected_component && to_string(socket.assigns.selected_component.id) == component_id do
        put_in(socket.assigns.selected_component, [:position, String.to_atom(axis)], value)
      else
        socket.assigns.selected_component
      end
    
    # Push update to Three.js
    socket = push_event(socket, "update_component_position", %{
      id: component_id,
      axis: axis,
      value: value
    })
    
    {:noreply, 
     socket
     |> assign(:components, updated_components)
     |> assign(:selected_component, selected)
    }
  end
  
  def handle_event("update_color", %{"component-id" => component_id, "value" => color}, socket) do
    # Update in components map
    updated_components = 
      Map.update!(socket.assigns.components, String.to_integer(component_id), fn component ->
        Map.put(component, :color, color)
      end)
    
    # Update selected component if it matches
    selected = 
      if socket.assigns.selected_component && to_string(socket.assigns.selected_component.id) == component_id do
        Map.put(socket.assigns.selected_component, :color, color)
      else
        socket.assigns.selected_component
      end
    
    # Push update to Three.js
    socket = push_event(socket, "update_component_color", %{
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
    # Request current state from Three.js
    {:noreply, push_event(socket, "request_scene_state", %{})}
  end
  
  def handle_event("scene_state_ready", %{"objects" => objects, "scene_config" => scene_config}, socket) do
    # Convert JS objects to our component format
    components = Enum.reduce(objects, %{}, fn obj, acc ->
      component = %{
        id: obj["id"],
        type: obj["type"],
        position: %{
          x: obj["position"]["x"],
          y: obj["position"]["y"],
          z: obj["position"]["z"]
        },
        rotation: %{
          x: obj["rotation"]["x"],
          y: obj["rotation"]["y"],
          z: obj["rotation"]["z"]
        },
        scale: %{
          x: obj["scale"]["x"],
          y: obj["scale"]["y"],
          z: obj["scale"]["z"]
        },
        color: obj["color"],
        rotating: obj["rotating"],
        rotationSpeedX: obj["rotationSpeedX"],
        rotationSpeedY: obj["rotationSpeedY"]
      }
      Map.put(acc, obj["id"], component)
    end)
    
    model_data = %{
      components: components,
      scene_config: scene_config,
      camera_state: Map.get(scene_config, "camera", %{}),
      lighting_config: Map.get(scene_config, "lighting", %{})
    }
    
    # Save without user_id for now
    case Modeling.create_model(%{
      user_id: socket.assigns.current_user && socket.assigns.current_user.id || nil,
      name: "Scene #{DateTime.utc_now() |> Calendar.strftime("%Y-%m-%d %H:%M")}",
      data: model_data
    }) do
      {:ok, _model} ->
        {:noreply, 
         socket
         |> put_flash(:info, "Scene saved successfully!")
         |> load_all_models()
        }
      
      {:error, _changeset} ->
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

end