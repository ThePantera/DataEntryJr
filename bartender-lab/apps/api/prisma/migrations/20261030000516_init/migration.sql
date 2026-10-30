-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'EDITOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "CategoryKind" AS ENUM ('INGREDIENT', 'RECIPE');

-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('DRAFT', 'REVIEW', 'VERIFIED', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "RecipeOrigin" AS ENUM ('CLASSIC', 'ORIGINAL');

-- CreateEnum
CREATE TYPE "IceType" AS ENUM ('NONE', 'CUBED', 'CRUSHED', 'LARGE_CUBE', 'SPHERE', 'BLOCK', 'SHAVED');

-- CreateEnum
CREATE TYPE "Unit" AS ENUM ('ML', 'CL', 'OZ', 'DASH', 'DROP', 'BARSPOON', 'TEASPOON', 'TABLESPOON', 'GRAM', 'UNIT', 'SLICE', 'WEDGE', 'SPRIG', 'LEAF', 'PINCH', 'TOP_UP');

-- CreateEnum
CREATE TYPE "Allergen" AS ENUM ('CELERY', 'GLUTEN', 'CRUSTACEANS', 'EGGS', 'FISH', 'LUPIN', 'MILK', 'MOLLUSCS', 'MUSTARD', 'TREE_NUTS', 'PEANUTS', 'SESAME', 'SOY', 'SULPHITES');

-- CreateEnum
CREATE TYPE "ResourceType" AS ENUM ('RECIPE', 'INGREDIENT', 'TECHNIQUE', 'GLASSWARE', 'EQUIPMENT', 'CATEGORY');

-- CreateEnum
CREATE TYPE "SyncEntityType" AS ENUM ('FAVORITE', 'INVENTORY', 'SHOPPING_LIST', 'SHOPPING_LIST_ITEM');

-- CreateEnum
CREATE TYPE "SyncAction" AS ENUM ('UPSERT', 'DELETE');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('APPLIED', 'MERGED', 'CONFLICT', 'REJECTED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "family_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "kind" "CategoryKind" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingredients" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category_id" UUID NOT NULL,
    "alcohol_percentage" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "image_url" TEXT,
    "allergens" "Allergen"[] DEFAULT ARRAY[]::"Allergen"[],
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingredient_substitutions" (
    "id" UUID NOT NULL,
    "ingredient_id" UUID NOT NULL,
    "substitute_id" UUID NOT NULL,
    "recipe_id" UUID,
    "ratio" DECIMAL(6,3) NOT NULL DEFAULT 1,
    "notes" TEXT,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ingredient_substitutions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "glassware" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "capacity_ml" INTEGER,
    "image_url" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "glassware_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "image_url" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "techniques" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "duration_seconds" INTEGER,
    "instructions" TEXT NOT NULL,
    "common_mistakes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "techniques_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "technique_equipment" (
    "technique_id" UUID NOT NULL,
    "equipment_id" UUID NOT NULL,

    CONSTRAINT "technique_equipment_pkey" PRIMARY KEY ("technique_id","equipment_id")
);

-- CreateTable
CREATE TABLE "recipes" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "history" TEXT,
    "difficulty" "Difficulty" NOT NULL,
    "preparation_time_seconds" INTEGER,
    "servings" INTEGER NOT NULL DEFAULT 1,
    "glassware_id" UUID,
    "technique_id" UUID,
    "ice_type" "IceType",
    "garnish" TEXT,
    "alcohol_percentage_estimated" DECIMAL(5,2),
    "instructions" TEXT,
    "image_url" TEXT,
    "source" TEXT,
    "origin" "RecipeOrigin" NOT NULL DEFAULT 'CLASSIC',
    "verification_status" "VerificationStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by_id" UUID,
    "published_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "recipes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_ingredients" (
    "id" UUID NOT NULL,
    "recipe_id" UUID NOT NULL,
    "ingredient_id" UUID NOT NULL,
    "quantity" DECIMAL(8,2),
    "unit" "Unit" NOT NULL,
    "optional" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL,

    CONSTRAINT "recipe_ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_steps" (
    "id" UUID NOT NULL,
    "recipe_id" UUID NOT NULL,
    "step_number" INTEGER NOT NULL,
    "instruction" TEXT NOT NULL,
    "duration_seconds" INTEGER,
    "image_url" TEXT,

    CONSTRAINT "recipe_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_categories" (
    "recipe_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,

    CONSTRAINT "recipe_categories_pkey" PRIMARY KEY ("recipe_id","category_id")
);

-- CreateTable
CREATE TABLE "inventory" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "ingredient_id" UUID NOT NULL,
    "quantity" DECIMAL(10,2),
    "unit" "Unit",
    "expiration_date" DATE,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "favorites" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "recipe_id" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "favorites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shopping_lists" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "shopping_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shopping_list_items" (
    "id" UUID NOT NULL,
    "shopping_list_id" UUID NOT NULL,
    "ingredient_id" UUID NOT NULL,
    "quantity" DECIMAL(10,2),
    "unit" "Unit",
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "shopping_list_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "download_manifest" (
    "id" UUID NOT NULL,
    "resource_type" "ResourceType" NOT NULL,
    "resource_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "download_manifest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_operations" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "op_id" UUID NOT NULL,
    "entity_type" "SyncEntityType" NOT NULL,
    "entity_id" UUID NOT NULL,
    "action" "SyncAction" NOT NULL,
    "status" "SyncStatus" NOT NULL,
    "result" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_operations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_family_id_idx" ON "refresh_tokens"("family_id");

-- CreateIndex
CREATE UNIQUE INDEX "categories_kind_name_key" ON "categories"("kind", "name");

-- CreateIndex
CREATE UNIQUE INDEX "ingredients_name_key" ON "ingredients"("name");

-- CreateIndex
CREATE INDEX "ingredients_category_id_idx" ON "ingredients"("category_id");

-- CreateIndex
CREATE INDEX "ingredient_substitutions_substitute_id_idx" ON "ingredient_substitutions"("substitute_id");

-- CreateIndex
CREATE UNIQUE INDEX "ingredient_substitutions_ingredient_id_substitute_id_recipe_key" ON "ingredient_substitutions"("ingredient_id", "substitute_id", "recipe_id");

-- CreateIndex
CREATE UNIQUE INDEX "glassware_name_key" ON "glassware"("name");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_name_key" ON "equipment"("name");

-- CreateIndex
CREATE UNIQUE INDEX "techniques_name_key" ON "techniques"("name");

-- CreateIndex
CREATE UNIQUE INDEX "recipes_slug_key" ON "recipes"("slug");

-- CreateIndex
CREATE INDEX "recipes_verification_status_idx" ON "recipes"("verification_status");

-- CreateIndex
CREATE INDEX "recipes_name_idx" ON "recipes"("name");

-- CreateIndex
CREATE INDEX "recipe_ingredients_ingredient_id_idx" ON "recipe_ingredients"("ingredient_id");

-- CreateIndex
CREATE UNIQUE INDEX "recipe_ingredients_recipe_id_ingredient_id_key" ON "recipe_ingredients"("recipe_id", "ingredient_id");

-- CreateIndex
CREATE UNIQUE INDEX "recipe_steps_recipe_id_step_number_key" ON "recipe_steps"("recipe_id", "step_number");

-- CreateIndex
CREATE INDEX "recipe_categories_category_id_idx" ON "recipe_categories"("category_id");

-- CreateIndex
CREATE INDEX "inventory_user_id_updated_at_idx" ON "inventory"("user_id", "updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_user_id_ingredient_id_key" ON "inventory"("user_id", "ingredient_id");

-- CreateIndex
CREATE INDEX "favorites_user_id_updated_at_idx" ON "favorites"("user_id", "updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "favorites_user_id_recipe_id_key" ON "favorites"("user_id", "recipe_id");

-- CreateIndex
CREATE INDEX "shopping_lists_user_id_updated_at_idx" ON "shopping_lists"("user_id", "updated_at");

-- CreateIndex
CREATE INDEX "shopping_list_items_shopping_list_id_updated_at_idx" ON "shopping_list_items"("shopping_list_id", "updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "shopping_list_items_shopping_list_id_ingredient_id_key" ON "shopping_list_items"("shopping_list_id", "ingredient_id");

-- CreateIndex
CREATE INDEX "download_manifest_updated_at_idx" ON "download_manifest"("updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "download_manifest_resource_type_resource_id_key" ON "download_manifest"("resource_type", "resource_id");

-- CreateIndex
CREATE INDEX "sync_operations_created_at_idx" ON "sync_operations"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "sync_operations_user_id_op_id_key" ON "sync_operations"("user_id", "op_id");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingredients" ADD CONSTRAINT "ingredients_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingredient_substitutions" ADD CONSTRAINT "ingredient_substitutions_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "ingredients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingredient_substitutions" ADD CONSTRAINT "ingredient_substitutions_substitute_id_fkey" FOREIGN KEY ("substitute_id") REFERENCES "ingredients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingredient_substitutions" ADD CONSTRAINT "ingredient_substitutions_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technique_equipment" ADD CONSTRAINT "technique_equipment_technique_id_fkey" FOREIGN KEY ("technique_id") REFERENCES "techniques"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technique_equipment" ADD CONSTRAINT "technique_equipment_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_glassware_id_fkey" FOREIGN KEY ("glassware_id") REFERENCES "glassware"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_technique_id_fkey" FOREIGN KEY ("technique_id") REFERENCES "techniques"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "ingredients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_steps" ADD CONSTRAINT "recipe_steps_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_categories" ADD CONSTRAINT "recipe_categories_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_categories" ADD CONSTRAINT "recipe_categories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "ingredients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shopping_lists" ADD CONSTRAINT "shopping_lists_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shopping_list_items" ADD CONSTRAINT "shopping_list_items_shopping_list_id_fkey" FOREIGN KEY ("shopping_list_id") REFERENCES "shopping_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shopping_list_items" ADD CONSTRAINT "shopping_list_items_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "ingredients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_operations" ADD CONSTRAINT "sync_operations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Restricciones de integridad adicionales (no representables en schema.prisma) ───

ALTER TABLE "users" ADD CONSTRAINT "users_email_lowercase_chk" CHECK ("email" = lower("email"));
ALTER TABLE "ingredients" ADD CONSTRAINT "ingredients_alcohol_percentage_chk" CHECK ("alcohol_percentage" >= 0 AND "alcohol_percentage" <= 100);
ALTER TABLE "ingredient_substitutions" ADD CONSTRAINT "ingredient_substitutions_not_self_chk" CHECK ("ingredient_id" <> "substitute_id");
ALTER TABLE "ingredient_substitutions" ADD CONSTRAINT "ingredient_substitutions_ratio_chk" CHECK ("ratio" > 0);
ALTER TABLE "glassware" ADD CONSTRAINT "glassware_capacity_chk" CHECK ("capacity_ml" IS NULL OR "capacity_ml" > 0);
ALTER TABLE "techniques" ADD CONSTRAINT "techniques_duration_chk" CHECK ("duration_seconds" IS NULL OR "duration_seconds" > 0);
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_servings_chk" CHECK ("servings" >= 1);
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_preparation_time_chk" CHECK ("preparation_time_seconds" IS NULL OR "preparation_time_seconds" > 0);
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_alcohol_percentage_chk" CHECK ("alcohol_percentage_estimated" IS NULL OR ("alcohol_percentage_estimated" >= 0 AND "alcohol_percentage_estimated" <= 100));
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_version_chk" CHECK ("version" >= 1);
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_quantity_chk" CHECK (("unit" = 'TOP_UP' AND "quantity" IS NULL) OR ("unit" <> 'TOP_UP' AND "quantity" > 0));
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_position_chk" CHECK ("position" >= 0);
ALTER TABLE "recipe_steps" ADD CONSTRAINT "recipe_steps_step_number_chk" CHECK ("step_number" >= 1);
ALTER TABLE "recipe_steps" ADD CONSTRAINT "recipe_steps_duration_chk" CHECK ("duration_seconds" IS NULL OR "duration_seconds" > 0);
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_quantity_chk" CHECK ("quantity" IS NULL OR "quantity" >= 0);
ALTER TABLE "shopping_list_items" ADD CONSTRAINT "shopping_list_items_quantity_chk" CHECK ("quantity" IS NULL OR "quantity" > 0);
ALTER TABLE "download_manifest" ADD CONSTRAINT "download_manifest_version_chk" CHECK ("version" >= 1);
