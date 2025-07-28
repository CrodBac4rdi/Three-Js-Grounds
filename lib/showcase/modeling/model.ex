defmodule Showcase.Modeling.Model do
  use Ecto.Schema
  import Ecto.Changeset

  schema "models" do
    field :data, {:map, :string}
    field :name, :string
    field :user_id, :id

    timestamps(type: :utc_datetime)
  end

  @doc false
  def changeset(model, attrs) do
    model
    |> cast(attrs, [:name, :data])
    |> validate_required([:name, :data])
  end
end
