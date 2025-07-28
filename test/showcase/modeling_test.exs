defmodule Showcase.ModelingTest do
  use Showcase.DataCase

  alias Showcase.Modeling

  describe "models" do
    alias Showcase.Modeling.Model

    import Showcase.ModelingFixtures

    @invalid_attrs %{data: nil, name: nil}

    test "list_models/0 returns all models" do
      model = model_fixture()
      assert Modeling.list_models() == [model]
    end

    test "get_model!/1 returns the model with given id" do
      model = model_fixture()
      assert Modeling.get_model!(model.id) == model
    end

    test "create_model/1 with valid data creates a model" do
      valid_attrs = %{data: "some data", name: "some name"}

      assert {:ok, %Model{} = model} = Modeling.create_model(valid_attrs)
      assert model.data == "some data"
      assert model.name == "some name"
    end

    test "create_model/1 with invalid data returns error changeset" do
      assert {:error, %Ecto.Changeset{}} = Modeling.create_model(@invalid_attrs)
    end

    test "update_model/2 with valid data updates the model" do
      model = model_fixture()
      update_attrs = %{data: "some updated data", name: "some updated name"}

      assert {:ok, %Model{} = model} = Modeling.update_model(model, update_attrs)
      assert model.data == "some updated data"
      assert model.name == "some updated name"
    end

    test "update_model/2 with invalid data returns error changeset" do
      model = model_fixture()
      assert {:error, %Ecto.Changeset{}} = Modeling.update_model(model, @invalid_attrs)
      assert model == Modeling.get_model!(model.id)
    end

    test "delete_model/1 deletes the model" do
      model = model_fixture()
      assert {:ok, %Model{}} = Modeling.delete_model(model)
      assert_raise Ecto.NoResultsError, fn -> Modeling.get_model!(model.id) end
    end

    test "change_model/1 returns a model changeset" do
      model = model_fixture()
      assert %Ecto.Changeset{} = Modeling.change_model(model)
    end
  end
end
