defmodule Showcase.ModelingFixtures do
  @moduledoc """
  This module defines test helpers for creating
  entities via the `Showcase.Modeling` context.
  """

  @doc """
  Generate a model.
  """
  def model_fixture(attrs \\ %{}) do
    {:ok, model} =
      attrs
      |> Enum.into(%{
        data: "some data",
        name: "some name"
      })
      |> Showcase.Modeling.create_model()

    model
  end
end
