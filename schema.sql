-- Schema for Library Management System (PostgreSQL)

-- Admin table
CREATE TABLE IF NOT EXISTS "Admins" (
    "id" SERIAL PRIMARY KEY,
    "username" VARCHAR(255) NOT NULL UNIQUE,
    "password" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
    "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Students table
CREATE TABLE IF NOT EXISTS "Students" (
    "id" SERIAL PRIMARY KEY,
    "name" VARCHAR(255) NOT NULL,
    "nisn" VARCHAR(255) NOT NULL UNIQUE,
    "class" VARCHAR(255) NOT NULL,
    "qr_code_path" VARCHAR(255),
    "photo_path" VARCHAR(255),
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
    "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Books table
CREATE TABLE IF NOT EXISTS "Books" (
    "id" SERIAL PRIMARY KEY,
    "title" VARCHAR(255) NOT NULL,
    "author" VARCHAR(255) NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "cover_path" VARCHAR(255),
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
    "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Settings table
CREATE TABLE IF NOT EXISTS "Settings" (
    "id" SERIAL PRIMARY KEY,
    "key" VARCHAR(255) NOT NULL UNIQUE,
    "value" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
    "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Transactions table
CREATE TABLE IF NOT EXISTS "Transactions" (
    "id" SERIAL PRIMARY KEY,
    "borrow_date" DATE NOT NULL,
    "expected_return_date" DATE NOT NULL,
    "return_date" DATE,
    "fine" INTEGER DEFAULT 0,
    "student_id" INTEGER REFERENCES "Students"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    "book_id" INTEGER REFERENCES "Books"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
    "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL
);
