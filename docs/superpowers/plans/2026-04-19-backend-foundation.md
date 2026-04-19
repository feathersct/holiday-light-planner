# Christmas Light Map — Backend Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a working Spring Boot app with OAuth2 login (Google + Facebook), JWT authentication via HttpOnly cookie, Flyway-managed PostgreSQL schema, and a `/api/v1/auth/me` endpoint verifiable with Postman.

**Architecture:** Spring Boot 3.2 handles the OAuth2 redirect flow. On successful login, a custom `OAuth2SuccessHandler` issues a JWT stored in an HttpOnly cookie. A `JwtAuthFilter` reads this cookie on every subsequent request and populates the `SecurityContext`. No server-side session state is held.

**Tech Stack:** Java 17, Spring Boot 3.2.5, Spring Security 6, JJWT 0.12.3, Flyway, PostgreSQL 15 + PostGIS 3.3 (Docker Compose), Hibernate Spatial, JTS Core 1.19, Lombok, Testcontainers (tests only)

---

## File Map

| File | Purpose |
|---|---|
| `docker-compose.yml` | PostgreSQL 15 + PostGIS container |
| `.env.example` | Template for required environment variables |
| `backend/pom.xml` | All Maven dependencies |
| `backend/src/main/java/com/christmaslightmap/ChristmasLightMapApplication.java` | Spring Boot entry point |
| `backend/src/main/resources/application.properties` | All config keys (secrets via env vars) |
| `backend/src/main/resources/db/migration/V1__enable_postgis.sql` | PostGIS extension |
| `backend/src/main/resources/db/migration/V2__create_users.sql` | users table |
| `backend/src/main/resources/db/migration/V3__create_displays.sql` | displays table |
| `backend/src/main/resources/db/migration/V4__create_display_photos.sql` | display_photos table |
| `backend/src/main/resources/db/migration/V5__create_upvotes.sql` | upvotes table |
| `backend/src/main/resources/db/migration/V6__create_tags.sql` | tags table + seed data |
| `backend/src/main/resources/db/migration/V7__create_display_tags.sql` | display_tags join table |
| `backend/src/main/resources/db/migration/V8__create_seasons.sql` | seasons table |
| `backend/src/main/resources/db/migration/V9__create_reports.sql` | reports table |
| `backend/src/main/resources/db/migration/V10__create_triggers.sql` | upvote_count + photo_count triggers |
| `backend/src/main/java/com/christmaslightmap/model/UserRole.java` | USER / ADMIN enum |
| `backend/src/main/java/com/christmaslightmap/model/DisplayType.java` | DRIVE_BY / WALK_THROUGH / BOTH enum |
| `backend/src/main/java/com/christmaslightmap/model/ReportStatus.java` | OPEN / REVIEWED / RESOLVED / DISMISSED enum |
| `backend/src/main/java/com/christmaslightmap/model/ReportReason.java` | SPAM / WRONG_ADDRESS / OFFENSIVE / DUPLICATE / OTHER enum |
| `backend/src/main/java/com/christmaslightmap/model/User.java` | JPA entity |
| `backend/src/main/java/com/christmaslightmap/model/Display.java` | JPA entity (PostGIS Point) |
| `backend/src/main/java/com/christmaslightmap/model/DisplayPhoto.java` | JPA entity |
| `backend/src/main/java/com/christmaslightmap/model/Upvote.java` | JPA entity |
| `backend/src/main/java/com/christmaslightmap/model/Tag.java` | JPA entity |
| `backend/src/main/java/com/christmaslightmap/model/Season.java` | JPA entity |
| `backend/src/main/java/com/christmaslightmap/model/Report.java` | JPA entity |
| `backend/src/main/java/com/christmaslightmap/repository/UserRepository.java` | findByProviderAndProviderId |
| `backend/src/main/java/com/christmaslightmap/security/JwtService.java` | Issue / validate / parse JWT |
| `backend/src/main/java/com/christmaslightmap/security/CustomOAuth2User.java` | Wraps OAuth2User + User entity |
| `backend/src/main/java/com/christmaslightmap/security/OAuth2UserService.java` | Upserts user on OAuth login |
| `backend/src/main/java/com/christmaslightmap/security/OAuth2SuccessHandler.java` | Issues JWT cookie, redirects to Angular |
| `backend/src/main/java/com/christmaslightmap/security/JwtAuthFilter.java` | Reads jwt cookie, sets SecurityContext |
| `backend/src/main/java/com/christmaslightmap/config/CorsConfig.java` | CORS configuration bean |
| `backend/src/main/java/com/christmaslightmap/config/StorageConfig.java` | S3Client bean for Cloudflare R2 |
| `backend/src/main/java/com/christmaslightmap/config/SecurityConfig.java` | Spring Security filter chain |
| `backend/src/main/java/com/christmaslightmap/dto/response/ApiResponse.java` | Generic `{ success, data, message }` wrapper |
| `backend/src/main/java/com/christmaslightmap/dto/response/UserResponse.java` | User DTO returned by /auth/me |
| `backend/src/main/java/com/christmaslightmap/controller/AuthController.java` | GET /auth/me, POST /auth/logout |
| `backend/src/test/resources/application-test.properties` | Test config (dummy OAuth2 creds, Testcontainers DB) |
| `backend/src/test/java/com/christmaslightmap/AuthControllerTest.java` | Integration test |

---

## Task 1: Google OAuth2 Setup

**Files:** None (external setup)

- [ ] **Step 1: Create Google Cloud project**

  Go to https://console.cloud.google.com → "New Project" → name it `christmas-light-map`.

- [ ] **Step 2: Enable the Google+ API**

  In the project: APIs & Services → Library → search "Google+ API" → Enable.

- [ ] **Step 3: Create OAuth2 credentials**

  APIs & Services → Credentials → "Create Credentials" → OAuth client ID → Application type: "Web application".

  Set these Authorized redirect URIs:
  - `http://localhost:8080/login/oauth2/code/google`

  Save the **Client ID** and **Client Secret** — you'll put these in `.env`.

- [ ] **Step 4: Configure OAuth consent screen**

  APIs & Services → OAuth consent screen → External → fill in App name, user support email. Add your own email as a test user. Leave scopes as `openid`, `email`, `profile`.

- [ ] **Step 5: Commit**

  ```bash
  git commit --allow-empty -m "chore: google oauth2 app created (credentials in .env)"
  ```

---

## Task 2: Facebook OAuth2 Setup

**Files:** None (external setup)

- [ ] **Step 1: Create Facebook Developer app**

  Go to https://developers.facebook.com → My Apps → Create App → "Consumer" type → name it `Christmas Light Map`.

- [ ] **Step 2: Add Facebook Login product**

  Dashboard → Add Product → Facebook Login → Web → skip quickstart.

- [ ] **Step 3: Configure Valid OAuth Redirect URIs**

  Facebook Login → Settings → Valid OAuth Redirect URIs:
  - `http://localhost:8080/login/oauth2/code/facebook`

  Save changes.

- [ ] **Step 4: Copy credentials**

  App Dashboard → Settings → Basic → copy **App ID** and **App Secret**. Put these in `.env`.

- [ ] **Step 5: Commit**

  ```bash
  git commit --allow-empty -m "chore: facebook oauth2 app created (credentials in .env)"
  ```

---

## Task 3: Cloudflare R2 Setup

**Files:** None (external setup)

- [ ] **Step 1: Create Cloudflare account and R2 bucket**

  Log in to https://dash.cloudflare.com → R2 Object Storage → "Create bucket" → name it `christmas-light-map-photos`.

- [ ] **Step 2: Create R2 API token**

  R2 → Manage R2 API Tokens → "Create API token" → Permissions: "Object Read & Write" → select your bucket → Create.

  Copy the **Access Key ID** and **Secret Access Key** — these are shown only once.

- [ ] **Step 3: Note your account ID**

  Find it in the Cloudflare dashboard sidebar or URL. Your R2 endpoint will be:
  `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`

- [ ] **Step 4: Commit**

  ```bash
  git commit --allow-empty -m "chore: cloudflare r2 bucket created (credentials in .env)"
  ```

---

## Task 4: Spring Boot Project Initialization

**Files:**
- Create: `backend/pom.xml`
- Create: `backend/src/main/java/com/christmaslightmap/ChristmasLightMapApplication.java`

- [ ] **Step 1: Scaffold project via Spring Initializr**

  ```bash
  curl https://start.spring.io/starter.zip \
    -d type=maven-project \
    -d language=java \
    -d bootVersion=3.2.5 \
    -d baseDir=backend \
    -d groupId=com.christmaslightmap \
    -d artifactId=christmas-light-map \
    -d name=ChristmasLightMap \
    -d packageName=com.christmaslightmap \
    -d javaVersion=17 \
    -d dependencies=web,security,oauth2-client,data-jpa,postgresql,flyway,lombok \
    -o backend.zip && unzip backend.zip && rm backend.zip
  ```

- [ ] **Step 2: Replace pom.xml with full dependency list**

  Replace the generated `backend/pom.xml` with:

  ```xml
  <?xml version="1.0" encoding="UTF-8"?>
  <project xmlns="http://maven.apache.org/POM/4.0.0"
           xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
           xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>

    <parent>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-parent</artifactId>
      <version>3.2.5</version>
      <relativePath/>
    </parent>

    <groupId>com.christmaslightmap</groupId>
    <artifactId>christmas-light-map</artifactId>
    <version>0.0.1-SNAPSHOT</version>
    <name>ChristmasLightMap</name>

    <properties>
      <java.version>17</java.version>
      <jjwt.version>0.12.3</jjwt.version>
      <awssdk.version>2.25.28</awssdk.version>
    </properties>

    <dependencyManagement>
      <dependencies>
        <dependency>
          <groupId>software.amazon.awssdk</groupId>
          <artifactId>bom</artifactId>
          <version>${awssdk.version}</version>
          <type>pom</type>
          <scope>import</scope>
        </dependency>
      </dependencies>
    </dependencyManagement>

    <dependencies>
      <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-web</artifactId>
      </dependency>
      <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-security</artifactId>
      </dependency>
      <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-oauth2-client</artifactId>
      </dependency>
      <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-data-jpa</artifactId>
      </dependency>
      <dependency>
        <groupId>org.postgresql</groupId>
        <artifactId>postgresql</artifactId>
        <scope>runtime</scope>
      </dependency>
      <dependency>
        <groupId>org.flywaydb</groupId>
        <artifactId>flyway-core</artifactId>
      </dependency>
      <dependency>
        <groupId>org.hibernate.orm</groupId>
        <artifactId>hibernate-spatial</artifactId>
      </dependency>
      <dependency>
        <groupId>org.locationtech.jts</groupId>
        <artifactId>jts-core</artifactId>
        <version>1.19.0</version>
      </dependency>
      <dependency>
        <groupId>io.jsonwebtoken</groupId>
        <artifactId>jjwt-api</artifactId>
        <version>${jjwt.version}</version>
      </dependency>
      <dependency>
        <groupId>io.jsonwebtoken</groupId>
        <artifactId>jjwt-impl</artifactId>
        <version>${jjwt.version}</version>
        <scope>runtime</scope>
      </dependency>
      <dependency>
        <groupId>io.jsonwebtoken</groupId>
        <artifactId>jjwt-jackson</artifactId>
        <version>${jjwt.version}</version>
        <scope>runtime</scope>
      </dependency>
      <dependency>
        <groupId>software.amazon.awssdk</groupId>
        <artifactId>s3</artifactId>
      </dependency>
      <dependency>
        <groupId>org.projectlombok</groupId>
        <artifactId>lombok</artifactId>
        <optional>true</optional>
      </dependency>
      <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-test</artifactId>
        <scope>test</scope>
      </dependency>
      <dependency>
        <groupId>org.testcontainers</groupId>
        <artifactId>postgresql</artifactId>
        <scope>test</scope>
      </dependency>
      <dependency>
        <groupId>org.testcontainers</groupId>
        <artifactId>junit-jupiter</artifactId>
        <scope>test</scope>
      </dependency>
    </dependencies>

    <build>
      <plugins>
        <plugin>
          <groupId>org.springframework.boot</groupId>
          <artifactId>spring-boot-maven-plugin</artifactId>
          <configuration>
            <excludes>
              <exclude>
                <groupId>org.projectlombok</groupId>
                <artifactId>lombok</artifactId>
              </exclude>
            </excludes>
          </configuration>
        </plugin>
      </plugins>
    </build>
  </project>
  ```

- [ ] **Step 3: Verify main application class exists**

  `backend/src/main/java/com/christmaslightmap/ChristmasLightMapApplication.java` should contain:

  ```java
  package com.christmaslightmap;

  import org.springframework.boot.SpringApplication;
  import org.springframework.boot.autoconfigure.SpringBootApplication;

  @SpringBootApplication
  public class ChristmasLightMapApplication {
      public static void main(String[] args) {
          SpringApplication.run(ChristmasLightMapApplication.class, args);
      }
  }
  ```

- [ ] **Step 4: Commit**

  ```bash
  cd backend && git add pom.xml src/main/java/com/christmaslightmap/ChristmasLightMapApplication.java
  git commit -m "chore: initialize spring boot project with all dependencies"
  ```

---

## Task 5: Docker Compose + Config Files

**Files:**
- Create: `docker-compose.yml` (repo root)
- Create: `.env.example` (repo root)
- Create: `backend/src/main/resources/application.properties`
- Modify: `.gitignore`

- [ ] **Step 1: Create docker-compose.yml at repo root**

  ```yaml
  version: '3.8'
  services:
    db:
      image: postgis/postgis:15-3.3
      ports:
        - "5432:5432"
      environment:
        POSTGRES_DB: christmaslightmap
        POSTGRES_USER: postgres
        POSTGRES_PASSWORD: changeme
      volumes:
        - postgres_data:/var/lib/postgresql/data

  volumes:
    postgres_data:
  ```

- [ ] **Step 2: Create .env.example**

  ```
  GOOGLE_CLIENT_ID=your-google-client-id
  GOOGLE_CLIENT_SECRET=your-google-client-secret
  FACEBOOK_CLIENT_ID=your-facebook-app-id
  FACEBOOK_CLIENT_SECRET=your-facebook-app-secret
  # JWT secret must be at least 32 characters
  JWT_SECRET=replace-with-a-random-32-plus-character-string
  # R2: https://<ACCOUNT_ID>.r2.cloudflarestorage.com
  R2_ENDPOINT=https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com
  R2_BUCKET=christmas-light-map-photos
  R2_ACCESS_KEY=your-r2-access-key-id
  R2_SECRET_KEY=your-r2-secret-access-key
  ```

- [ ] **Step 3: Copy .env.example to .env and fill in real values**

  ```bash
  cp .env.example .env
  # Edit .env with your actual credentials
  ```

- [ ] **Step 4: Add .env to .gitignore**

  Add these lines to `.gitignore` if not already present:

  ```
  .env
  .superpowers/
  ```

- [ ] **Step 5: Create application.properties**

  ```properties
  # Database
  spring.datasource.url=jdbc:postgresql://localhost:5432/christmaslightmap
  spring.datasource.username=postgres
  spring.datasource.password=changeme

  # JPA / Hibernate
  spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.PostgreSQLDialect
  spring.jpa.hibernate.ddl-auto=validate
  spring.jpa.show-sql=false

  # Flyway
  spring.flyway.enabled=true

  # OAuth2 — Google
  spring.security.oauth2.client.registration.google.client-id=${GOOGLE_CLIENT_ID}
  spring.security.oauth2.client.registration.google.client-secret=${GOOGLE_CLIENT_SECRET}
  spring.security.oauth2.client.registration.google.scope=openid,profile,email

  # OAuth2 — Facebook
  spring.security.oauth2.client.registration.facebook.client-id=${FACEBOOK_CLIENT_ID}
  spring.security.oauth2.client.registration.facebook.client-secret=${FACEBOOK_CLIENT_SECRET}
  spring.security.oauth2.client.registration.facebook.scope=email,public_profile
  spring.security.oauth2.client.provider.facebook.user-info-uri=https://graph.facebook.com/me?fields=id,name,email,picture

  # JWT
  app.jwt.secret=${JWT_SECRET}
  app.jwt.expiration-days=7

  # Cloudflare R2
  app.r2.endpoint=${R2_ENDPOINT}
  app.r2.bucket=${R2_BUCKET}
  app.r2.access-key=${R2_ACCESS_KEY}
  app.r2.secret-key=${R2_SECRET_KEY}

  # File upload
  spring.servlet.multipart.max-file-size=10MB
  spring.servlet.multipart.max-request-size=10MB

  # CORS
  app.cors.allowed-origins=http://localhost:4200

  # OAuth2 post-login redirect
  app.oauth2.redirect-uri=http://localhost:4200
  ```

- [ ] **Step 6: Commit**

  ```bash
  git add docker-compose.yml .env.example .gitignore backend/src/main/resources/application.properties
  git commit -m "chore: add docker compose, env template, and application config"
  ```

---

## Task 6: Flyway Migrations V1–V5

**Files:**
- Create: `backend/src/main/resources/db/migration/V1__enable_postgis.sql`
- Create: `backend/src/main/resources/db/migration/V2__create_users.sql`
- Create: `backend/src/main/resources/db/migration/V3__create_displays.sql`
- Create: `backend/src/main/resources/db/migration/V4__create_display_photos.sql`
- Create: `backend/src/main/resources/db/migration/V5__create_upvotes.sql`

- [ ] **Step 1: Create V1__enable_postgis.sql**

  ```sql
  CREATE EXTENSION IF NOT EXISTS postgis;
  ```

- [ ] **Step 2: Create V2__create_users.sql**

  ```sql
  CREATE TABLE users (
      id         BIGSERIAL PRIMARY KEY,
      provider   VARCHAR(20)  NOT NULL,
      provider_id VARCHAR(255) NOT NULL,
      email      VARCHAR(255) NOT NULL,
      name       VARCHAR(255),
      avatar_url VARCHAR(500),
      role       VARCHAR(20)  NOT NULL DEFAULT 'USER',
      created_at TIMESTAMP    NOT NULL DEFAULT NOW(),
      UNIQUE (provider, provider_id)
  );
  ```

- [ ] **Step 3: Create V3__create_displays.sql**

  ```sql
  CREATE TABLE displays (
      id           BIGSERIAL PRIMARY KEY,
      user_id      BIGINT       NOT NULL REFERENCES users(id),
      title        VARCHAR(255) NOT NULL,
      description  TEXT,
      address      VARCHAR(500),
      city         VARCHAR(100),
      state        VARCHAR(100),
      postcode     VARCHAR(20),
      location     GEOGRAPHY(POINT, 4326) NOT NULL,
      best_time    VARCHAR(255),
      display_type VARCHAR(20)  NOT NULL DEFAULT 'DRIVE_BY',
      upvote_count INT          NOT NULL DEFAULT 0,
      photo_count  INT          NOT NULL DEFAULT 0,
      is_active    BOOLEAN      NOT NULL DEFAULT TRUE,
      created_at   TIMESTAMP    NOT NULL DEFAULT NOW()
  );

  CREATE INDEX idx_displays_location ON displays USING GIST (location);
  CREATE INDEX idx_displays_active ON displays (is_active);
  ```

- [ ] **Step 4: Create V4__create_display_photos.sql**

  ```sql
  CREATE TABLE display_photos (
      id         BIGSERIAL PRIMARY KEY,
      display_id BIGINT       NOT NULL REFERENCES displays(id),
      user_id    BIGINT       NOT NULL REFERENCES users(id),
      url        VARCHAR(500) NOT NULL,
      is_primary BOOLEAN      NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP    NOT NULL DEFAULT NOW()
  );

  CREATE UNIQUE INDEX idx_display_photos_primary
      ON display_photos (display_id)
      WHERE is_primary = TRUE;
  ```

- [ ] **Step 5: Create V5__create_upvotes.sql**

  ```sql
  CREATE TABLE upvotes (
      id         BIGSERIAL PRIMARY KEY,
      user_id    BIGINT    NOT NULL REFERENCES users(id),
      display_id BIGINT    NOT NULL REFERENCES displays(id),
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, display_id)
  );
  ```

- [ ] **Step 6: Commit**

  ```bash
  git add backend/src/main/resources/db/migration/
  git commit -m "feat: add flyway migrations V1-V5 (postgis, users, displays, photos, upvotes)"
  ```

---

## Task 7: Flyway Migrations V6–V10

**Files:**
- Create: `backend/src/main/resources/db/migration/V6__create_tags.sql`
- Create: `backend/src/main/resources/db/migration/V7__create_display_tags.sql`
- Create: `backend/src/main/resources/db/migration/V8__create_seasons.sql`
- Create: `backend/src/main/resources/db/migration/V9__create_reports.sql`
- Create: `backend/src/main/resources/db/migration/V10__create_triggers.sql`

- [ ] **Step 1: Create V6__create_tags.sql**

  ```sql
  CREATE TABLE tags (
      id         BIGSERIAL    PRIMARY KEY,
      name       VARCHAR(100) NOT NULL UNIQUE,
      created_at TIMESTAMP    NOT NULL DEFAULT NOW()
  );

  INSERT INTO tags (name) VALUES
      ('animated'),
      ('music-synced'),
      ('walk-through'),
      ('drive-by'),
      ('inflatables'),
      ('lights-only');
  ```

- [ ] **Step 2: Create V7__create_display_tags.sql**

  ```sql
  CREATE TABLE display_tags (
      display_id BIGINT NOT NULL REFERENCES displays(id),
      tag_id     BIGINT NOT NULL REFERENCES tags(id),
      PRIMARY KEY (display_id, tag_id)
  );
  ```

- [ ] **Step 3: Create V8__create_seasons.sql**

  ```sql
  CREATE TABLE seasons (
      id         BIGSERIAL PRIMARY KEY,
      display_id BIGINT    NOT NULL REFERENCES displays(id),
      year       INT       NOT NULL,
      is_active  BOOLEAN   NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE (display_id, year)
  );
  ```

- [ ] **Step 4: Create V9__create_reports.sql**

  ```sql
  CREATE TABLE reports (
      id         BIGSERIAL   PRIMARY KEY,
      display_id BIGINT      NOT NULL REFERENCES displays(id),
      user_id    BIGINT      NOT NULL REFERENCES users(id),
      reason     VARCHAR(50) NOT NULL,
      notes      TEXT,
      status     VARCHAR(20) NOT NULL DEFAULT 'OPEN',
      created_at TIMESTAMP   NOT NULL DEFAULT NOW()
  );
  ```

- [ ] **Step 5: Create V10__create_triggers.sql**

  ```sql
  -- Upvote count trigger
  CREATE OR REPLACE FUNCTION update_upvote_count() RETURNS TRIGGER AS $$
  BEGIN
      IF TG_OP = 'INSERT' THEN
          UPDATE displays SET upvote_count = upvote_count + 1 WHERE id = NEW.display_id;
      ELSIF TG_OP = 'DELETE' THEN
          UPDATE displays SET upvote_count = upvote_count - 1 WHERE id = OLD.display_id;
      END IF;
      RETURN NULL;
  END;
  $$ LANGUAGE plpgsql;

  CREATE TRIGGER trg_upvote_count
      AFTER INSERT OR DELETE ON upvotes
      FOR EACH ROW EXECUTE FUNCTION update_upvote_count();

  -- Photo count trigger
  CREATE OR REPLACE FUNCTION update_photo_count() RETURNS TRIGGER AS $$
  BEGIN
      IF TG_OP = 'INSERT' THEN
          UPDATE displays SET photo_count = photo_count + 1 WHERE id = NEW.display_id;
      ELSIF TG_OP = 'DELETE' THEN
          UPDATE displays SET photo_count = photo_count - 1 WHERE id = OLD.display_id;
      END IF;
      RETURN NULL;
  END;
  $$ LANGUAGE plpgsql;

  CREATE TRIGGER trg_photo_count
      AFTER INSERT OR DELETE ON display_photos
      FOR EACH ROW EXECUTE FUNCTION update_photo_count();
  ```

- [ ] **Step 6: Start Docker and verify all migrations run cleanly**

  ```bash
  # From repo root
  source .env
  docker-compose up -d
  cd backend && ./mvnw spring-boot:run
  ```

  Expected in startup logs:
  ```
  Successfully applied 10 migrations to schema "public"
  ```

  Stop the app with Ctrl+C after confirming.

- [ ] **Step 7: Commit**

  ```bash
  git add backend/src/main/resources/db/migration/
  git commit -m "feat: add flyway migrations V6-V10 (tags, display_tags, seasons, reports, triggers)"
  ```

---

## Task 8: JPA Enums

**Files:**
- Create: `backend/src/main/java/com/christmaslightmap/model/UserRole.java`
- Create: `backend/src/main/java/com/christmaslightmap/model/DisplayType.java`
- Create: `backend/src/main/java/com/christmaslightmap/model/ReportStatus.java`
- Create: `backend/src/main/java/com/christmaslightmap/model/ReportReason.java`

- [ ] **Step 1: Create UserRole.java**

  ```java
  package com.christmaslightmap.model;

  public enum UserRole {
      USER, ADMIN
  }
  ```

- [ ] **Step 2: Create DisplayType.java**

  ```java
  package com.christmaslightmap.model;

  public enum DisplayType {
      DRIVE_BY, WALK_THROUGH, BOTH
  }
  ```

- [ ] **Step 3: Create ReportStatus.java**

  ```java
  package com.christmaslightmap.model;

  public enum ReportStatus {
      OPEN, REVIEWED, RESOLVED, DISMISSED
  }
  ```

- [ ] **Step 4: Create ReportReason.java**

  ```java
  package com.christmaslightmap.model;

  public enum ReportReason {
      SPAM, WRONG_ADDRESS, OFFENSIVE, DUPLICATE, OTHER
  }
  ```

- [ ] **Step 5: Commit**

  ```bash
  git add backend/src/main/java/com/christmaslightmap/model/
  git commit -m "feat: add JPA enums (UserRole, DisplayType, ReportStatus, ReportReason)"
  ```

---

## Task 9: JPA Entity — User

**Files:**
- Create: `backend/src/main/java/com/christmaslightmap/model/User.java`

- [ ] **Step 1: Create User.java**

  ```java
  package com.christmaslightmap.model;

  import jakarta.persistence.*;
  import lombok.*;
  import org.hibernate.annotations.CreationTimestamp;

  import java.time.LocalDateTime;

  @Entity
  @Table(name = "users")
  @Data
  @Builder
  @NoArgsConstructor
  @AllArgsConstructor
  public class User {

      @Id
      @GeneratedValue(strategy = GenerationType.IDENTITY)
      private Long id;

      @Column(nullable = false, length = 20)
      private String provider;

      @Column(name = "provider_id", nullable = false)
      private String providerId;

      @Column(nullable = false)
      private String email;

      private String name;

      @Column(name = "avatar_url")
      private String avatarUrl;

      @Enumerated(EnumType.STRING)
      @Column(nullable = false)
      @Builder.Default
      private UserRole role = UserRole.USER;

      @CreationTimestamp
      @Column(name = "created_at", nullable = false, updatable = false)
      private LocalDateTime createdAt;
  }
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add backend/src/main/java/com/christmaslightmap/model/User.java
  git commit -m "feat: add User JPA entity"
  ```

---

## Task 10: Remaining JPA Entities

**Files:**
- Create: `backend/src/main/java/com/christmaslightmap/model/Display.java`
- Create: `backend/src/main/java/com/christmaslightmap/model/DisplayPhoto.java`
- Create: `backend/src/main/java/com/christmaslightmap/model/Upvote.java`
- Create: `backend/src/main/java/com/christmaslightmap/model/Tag.java`
- Create: `backend/src/main/java/com/christmaslightmap/model/Season.java`
- Create: `backend/src/main/java/com/christmaslightmap/model/Report.java`

- [ ] **Step 1: Create Display.java**

  ```java
  package com.christmaslightmap.model;

  import jakarta.persistence.*;
  import lombok.*;
  import org.hibernate.annotations.CreationTimestamp;
  import org.locationtech.jts.geom.Point;

  import java.time.LocalDateTime;
  import java.util.HashSet;
  import java.util.Set;

  @Entity
  @Table(name = "displays")
  @Data
  @Builder
  @NoArgsConstructor
  @AllArgsConstructor
  public class Display {

      @Id
      @GeneratedValue(strategy = GenerationType.IDENTITY)
      private Long id;

      @ManyToOne(fetch = FetchType.LAZY)
      @JoinColumn(name = "user_id", nullable = false)
      private User user;

      @Column(nullable = false)
      private String title;

      private String description;
      private String address;
      private String city;
      private String state;
      private String postcode;

      @Column(columnDefinition = "geography(Point, 4326)", nullable = false)
      private Point location;

      @Column(name = "best_time")
      private String bestTime;

      @Enumerated(EnumType.STRING)
      @Column(name = "display_type", nullable = false)
      @Builder.Default
      private DisplayType displayType = DisplayType.DRIVE_BY;

      @Column(name = "upvote_count", nullable = false)
      private int upvoteCount;

      @Column(name = "photo_count", nullable = false)
      private int photoCount;

      @Column(name = "is_active", nullable = false)
      @Builder.Default
      private boolean isActive = true;

      @CreationTimestamp
      @Column(name = "created_at", nullable = false, updatable = false)
      private LocalDateTime createdAt;

      @ManyToMany(fetch = FetchType.LAZY)
      @JoinTable(
          name = "display_tags",
          joinColumns = @JoinColumn(name = "display_id"),
          inverseJoinColumns = @JoinColumn(name = "tag_id")
      )
      @Builder.Default
      private Set<Tag> tags = new HashSet<>();
  }
  ```

- [ ] **Step 2: Create DisplayPhoto.java**

  ```java
  package com.christmaslightmap.model;

  import jakarta.persistence.*;
  import lombok.*;
  import org.hibernate.annotations.CreationTimestamp;

  import java.time.LocalDateTime;

  @Entity
  @Table(name = "display_photos")
  @Data
  @Builder
  @NoArgsConstructor
  @AllArgsConstructor
  public class DisplayPhoto {

      @Id
      @GeneratedValue(strategy = GenerationType.IDENTITY)
      private Long id;

      @ManyToOne(fetch = FetchType.LAZY)
      @JoinColumn(name = "display_id", nullable = false)
      private Display display;

      @ManyToOne(fetch = FetchType.LAZY)
      @JoinColumn(name = "user_id", nullable = false)
      private User user;

      @Column(nullable = false)
      private String url;

      @Column(name = "is_primary", nullable = false)
      @Builder.Default
      private boolean isPrimary = false;

      @CreationTimestamp
      @Column(name = "created_at", nullable = false, updatable = false)
      private LocalDateTime createdAt;
  }
  ```

- [ ] **Step 3: Create Upvote.java**

  ```java
  package com.christmaslightmap.model;

  import jakarta.persistence.*;
  import lombok.*;
  import org.hibernate.annotations.CreationTimestamp;

  import java.time.LocalDateTime;

  @Entity
  @Table(name = "upvotes")
  @Data
  @Builder
  @NoArgsConstructor
  @AllArgsConstructor
  public class Upvote {

      @Id
      @GeneratedValue(strategy = GenerationType.IDENTITY)
      private Long id;

      @ManyToOne(fetch = FetchType.LAZY)
      @JoinColumn(name = "user_id", nullable = false)
      private User user;

      @ManyToOne(fetch = FetchType.LAZY)
      @JoinColumn(name = "display_id", nullable = false)
      private Display display;

      @CreationTimestamp
      @Column(name = "created_at", nullable = false, updatable = false)
      private LocalDateTime createdAt;
  }
  ```

- [ ] **Step 4: Create Tag.java**

  ```java
  package com.christmaslightmap.model;

  import jakarta.persistence.*;
  import lombok.*;
  import org.hibernate.annotations.CreationTimestamp;

  import java.time.LocalDateTime;

  @Entity
  @Table(name = "tags")
  @Data
  @Builder
  @NoArgsConstructor
  @AllArgsConstructor
  public class Tag {

      @Id
      @GeneratedValue(strategy = GenerationType.IDENTITY)
      private Long id;

      @Column(nullable = false, unique = true)
      private String name;

      @CreationTimestamp
      @Column(name = "created_at", nullable = false, updatable = false)
      private LocalDateTime createdAt;
  }
  ```

- [ ] **Step 5: Create Season.java**

  ```java
  package com.christmaslightmap.model;

  import jakarta.persistence.*;
  import lombok.*;
  import org.hibernate.annotations.CreationTimestamp;

  import java.time.LocalDateTime;

  @Entity
  @Table(name = "seasons")
  @Data
  @Builder
  @NoArgsConstructor
  @AllArgsConstructor
  public class Season {

      @Id
      @GeneratedValue(strategy = GenerationType.IDENTITY)
      private Long id;

      @ManyToOne(fetch = FetchType.LAZY)
      @JoinColumn(name = "display_id", nullable = false)
      private Display display;

      @Column(nullable = false)
      private int year;

      @Column(name = "is_active", nullable = false)
      @Builder.Default
      private boolean isActive = true;

      @CreationTimestamp
      @Column(name = "created_at", nullable = false, updatable = false)
      private LocalDateTime createdAt;
  }
  ```

- [ ] **Step 6: Create Report.java**

  ```java
  package com.christmaslightmap.model;

  import jakarta.persistence.*;
  import lombok.*;
  import org.hibernate.annotations.CreationTimestamp;

  import java.time.LocalDateTime;

  @Entity
  @Table(name = "reports")
  @Data
  @Builder
  @NoArgsConstructor
  @AllArgsConstructor
  public class Report {

      @Id
      @GeneratedValue(strategy = GenerationType.IDENTITY)
      private Long id;

      @ManyToOne(fetch = FetchType.LAZY)
      @JoinColumn(name = "display_id", nullable = false)
      private Display display;

      @ManyToOne(fetch = FetchType.LAZY)
      @JoinColumn(name = "user_id", nullable = false)
      private User user;

      @Enumerated(EnumType.STRING)
      @Column(nullable = false, length = 50)
      private ReportReason reason;

      private String notes;

      @Enumerated(EnumType.STRING)
      @Column(nullable = false, length = 20)
      @Builder.Default
      private ReportStatus status = ReportStatus.OPEN;

      @CreationTimestamp
      @Column(name = "created_at", nullable = false, updatable = false)
      private LocalDateTime createdAt;
  }
  ```

- [ ] **Step 7: Verify app starts (entities map to DB schema)**

  ```bash
  source .env && cd backend && ./mvnw spring-boot:run
  ```

  Expected: app starts without `SchemaManagementException`. Stop with Ctrl+C.

- [ ] **Step 8: Commit**

  ```bash
  git add backend/src/main/java/com/christmaslightmap/model/
  git commit -m "feat: add all JPA entities (Display, DisplayPhoto, Upvote, Tag, Season, Report)"
  ```

---

## Task 11: UserRepository

**Files:**
- Create: `backend/src/main/java/com/christmaslightmap/repository/UserRepository.java`

- [ ] **Step 1: Create UserRepository.java**

  ```java
  package com.christmaslightmap.repository;

  import com.christmaslightmap.model.User;
  import org.springframework.data.jpa.repository.JpaRepository;

  import java.util.Optional;

  public interface UserRepository extends JpaRepository<User, Long> {
      Optional<User> findByProviderAndProviderId(String provider, String providerId);
  }
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add backend/src/main/java/com/christmaslightmap/repository/UserRepository.java
  git commit -m "feat: add UserRepository with findByProviderAndProviderId"
  ```

---

## Task 12: JwtService (TDD)

**Files:**
- Create: `backend/src/test/java/com/christmaslightmap/security/JwtServiceTest.java`
- Create: `backend/src/main/java/com/christmaslightmap/security/JwtService.java`

- [ ] **Step 1: Write the failing tests**

  Create `backend/src/test/java/com/christmaslightmap/security/JwtServiceTest.java`:

  ```java
  package com.christmaslightmap.security;

  import com.christmaslightmap.model.User;
  import com.christmaslightmap.model.UserRole;
  import org.junit.jupiter.api.BeforeEach;
  import org.junit.jupiter.api.Test;
  import org.springframework.test.util.ReflectionTestUtils;

  import static org.assertj.core.api.Assertions.assertThat;

  class JwtServiceTest {

      private JwtService jwtService;
      private User testUser;

      @BeforeEach
      void setUp() {
          jwtService = new JwtService();
          ReflectionTestUtils.setField(jwtService, "secret",
              "test-secret-key-that-is-at-least-32-characters-long!!");
          ReflectionTestUtils.setField(jwtService, "expirationDays", 7);

          testUser = User.builder()
              .id(42L)
              .email("test@example.com")
              .role(UserRole.USER)
              .build();
      }

      @Test
      void generateToken_producesNonBlankToken() {
          String token = jwtService.generateToken(testUser);
          assertThat(token).isNotBlank();
      }

      @Test
      void isTokenValid_returnsTrueForFreshToken() {
          String token = jwtService.generateToken(testUser);
          assertThat(jwtService.isTokenValid(token)).isTrue();
      }

      @Test
      void getUserId_extractsCorrectId() {
          String token = jwtService.generateToken(testUser);
          assertThat(jwtService.getUserId(token)).isEqualTo(42L);
      }

      @Test
      void getEmail_extractsCorrectEmail() {
          String token = jwtService.generateToken(testUser);
          assertThat(jwtService.getEmail(token)).isEqualTo("test@example.com");
      }

      @Test
      void getRole_extractsCorrectRole() {
          String token = jwtService.generateToken(testUser);
          assertThat(jwtService.getRole(token)).isEqualTo("USER");
      }

      @Test
      void isTokenValid_returnsFalseForTamperedToken() {
          String token = jwtService.generateToken(testUser) + "tampered";
          assertThat(jwtService.isTokenValid(token)).isFalse();
      }
  }
  ```

- [ ] **Step 2: Run tests to confirm they fail**

  ```bash
  cd backend && ./mvnw test -pl . -Dtest=JwtServiceTest -q
  ```

  Expected: compilation error — `JwtService` does not exist yet.

- [ ] **Step 3: Implement JwtService**

  Create `backend/src/main/java/com/christmaslightmap/security/JwtService.java`:

  ```java
  package com.christmaslightmap.security;

  import com.christmaslightmap.model.User;
  import io.jsonwebtoken.Claims;
  import io.jsonwebtoken.JwtException;
  import io.jsonwebtoken.Jwts;
  import io.jsonwebtoken.security.Keys;
  import org.springframework.beans.factory.annotation.Value;
  import org.springframework.stereotype.Service;

  import javax.crypto.SecretKey;
  import java.nio.charset.StandardCharsets;
  import java.util.Date;

  @Service
  public class JwtService {

      @Value("${app.jwt.secret}")
      private String secret;

      @Value("${app.jwt.expiration-days}")
      private int expirationDays;

      private SecretKey getSigningKey() {
          return Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
      }

      public String generateToken(User user) {
          return Jwts.builder()
              .subject(String.valueOf(user.getId()))
              .claim("email", user.getEmail())
              .claim("role", user.getRole().name())
              .issuedAt(new Date())
              .expiration(new Date(System.currentTimeMillis() + expirationDays * 24L * 60 * 60 * 1000))
              .signWith(getSigningKey())
              .compact();
      }

      public Claims parseToken(String token) {
          return Jwts.parser()
              .verifyWith(getSigningKey())
              .build()
              .parseSignedClaims(token)
              .getPayload();
      }

      public boolean isTokenValid(String token) {
          try {
              parseToken(token);
              return true;
          } catch (JwtException | IllegalArgumentException e) {
              return false;
          }
      }

      public Long getUserId(String token) {
          return Long.valueOf(parseToken(token).getSubject());
      }

      public String getEmail(String token) {
          return parseToken(token).get("email", String.class);
      }

      public String getRole(String token) {
          return parseToken(token).get("role", String.class);
      }
  }
  ```

- [ ] **Step 4: Run tests to confirm they pass**

  ```bash
  cd backend && ./mvnw test -Dtest=JwtServiceTest -q
  ```

  Expected: `Tests run: 6, Failures: 0, Errors: 0`

- [ ] **Step 5: Commit**

  ```bash
  git add backend/src/main/java/com/christmaslightmap/security/JwtService.java \
           backend/src/test/java/com/christmaslightmap/security/JwtServiceTest.java
  git commit -m "feat: add JwtService with issue/validate/parse (TDD)"
  ```

---

## Task 13: CustomOAuth2User + OAuth2UserService

**Files:**
- Create: `backend/src/main/java/com/christmaslightmap/security/CustomOAuth2User.java`
- Create: `backend/src/main/java/com/christmaslightmap/security/OAuth2UserService.java`

- [ ] **Step 1: Create CustomOAuth2User.java**

  ```java
  package com.christmaslightmap.security;

  import com.christmaslightmap.model.User;
  import lombok.Getter;
  import lombok.RequiredArgsConstructor;
  import org.springframework.security.core.GrantedAuthority;
  import org.springframework.security.core.authority.SimpleGrantedAuthority;
  import org.springframework.security.oauth2.core.user.OAuth2User;

  import java.util.Collection;
  import java.util.List;
  import java.util.Map;

  @RequiredArgsConstructor
  public class CustomOAuth2User implements OAuth2User {

      private final OAuth2User oauth2User;
      @Getter
      private final User user;

      @Override
      public Map<String, Object> getAttributes() {
          return oauth2User.getAttributes();
      }

      @Override
      public Collection<? extends GrantedAuthority> getAuthorities() {
          return List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole().name()));
      }

      @Override
      public String getName() {
          return user.getEmail();
      }
  }
  ```

- [ ] **Step 2: Create OAuth2UserService.java**

  ```java
  package com.christmaslightmap.security;

  import com.christmaslightmap.model.User;
  import com.christmaslightmap.model.UserRole;
  import com.christmaslightmap.repository.UserRepository;
  import lombok.RequiredArgsConstructor;
  import org.springframework.security.oauth2.client.userinfo.DefaultOAuth2UserService;
  import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
  import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
  import org.springframework.security.oauth2.core.user.OAuth2User;
  import org.springframework.stereotype.Service;

  import java.util.Map;

  @Service
  @RequiredArgsConstructor
  public class OAuth2UserService extends DefaultOAuth2UserService {

      private final UserRepository userRepository;

      @Override
      public OAuth2User loadUser(OAuth2UserRequest userRequest) throws OAuth2AuthenticationException {
          OAuth2User oauth2User = super.loadUser(userRequest);
          String registrationId = userRequest.getClientRegistration().getRegistrationId();

          String providerId;
          String email;
          String name;
          String avatarUrl;

          if ("google".equals(registrationId)) {
              providerId = oauth2User.getAttribute("sub");
              email = oauth2User.getAttribute("email");
              name = oauth2User.getAttribute("name");
              avatarUrl = oauth2User.getAttribute("picture");
          } else if ("facebook".equals(registrationId)) {
              providerId = oauth2User.getAttribute("id");
              email = oauth2User.getAttribute("email");
              name = oauth2User.getAttribute("name");
              Map<String, Object> picture = oauth2User.getAttribute("picture");
              @SuppressWarnings("unchecked")
              Map<String, Object> pictureData = picture != null ? (Map<String, Object>) picture.get("data") : null;
              avatarUrl = pictureData != null ? (String) pictureData.get("url") : null;
          } else {
              throw new OAuth2AuthenticationException("Unsupported provider: " + registrationId);
          }

          String finalEmail = email;
          String finalName = name;
          String finalAvatarUrl = avatarUrl;

          User user = userRepository.findByProviderAndProviderId(registrationId, providerId)
              .map(existing -> {
                  existing.setEmail(finalEmail);
                  existing.setName(finalName);
                  existing.setAvatarUrl(finalAvatarUrl);
                  return userRepository.save(existing);
              })
              .orElseGet(() -> userRepository.save(User.builder()
                  .provider(registrationId)
                  .providerId(providerId)
                  .email(finalEmail)
                  .name(finalName)
                  .avatarUrl(finalAvatarUrl)
                  .role(UserRole.USER)
                  .build()));

          return new CustomOAuth2User(oauth2User, user);
      }
  }
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add backend/src/main/java/com/christmaslightmap/security/CustomOAuth2User.java \
           backend/src/main/java/com/christmaslightmap/security/OAuth2UserService.java
  git commit -m "feat: add OAuth2UserService (upserts user on login) and CustomOAuth2User"
  ```

---

## Task 14: OAuth2SuccessHandler

**Files:**
- Create: `backend/src/main/java/com/christmaslightmap/security/OAuth2SuccessHandler.java`

- [ ] **Step 1: Create OAuth2SuccessHandler.java**

  ```java
  package com.christmaslightmap.security;

  import jakarta.servlet.http.HttpServletRequest;
  import jakarta.servlet.http.HttpServletResponse;
  import lombok.RequiredArgsConstructor;
  import org.springframework.beans.factory.annotation.Value;
  import org.springframework.http.HttpHeaders;
  import org.springframework.http.ResponseCookie;
  import org.springframework.security.core.Authentication;
  import org.springframework.security.web.authentication.SimpleUrlAuthenticationSuccessHandler;
  import org.springframework.stereotype.Component;

  import java.io.IOException;
  import java.time.Duration;

  @Component
  @RequiredArgsConstructor
  public class OAuth2SuccessHandler extends SimpleUrlAuthenticationSuccessHandler {

      private final JwtService jwtService;

      @Value("${app.oauth2.redirect-uri}")
      private String redirectUri;

      @Value("${app.jwt.expiration-days}")
      private int expirationDays;

      @Override
      public void onAuthenticationSuccess(HttpServletRequest request, HttpServletResponse response,
              Authentication authentication) throws IOException {
          CustomOAuth2User oAuth2User = (CustomOAuth2User) authentication.getPrincipal();
          String token = jwtService.generateToken(oAuth2User.getUser());

          ResponseCookie cookie = ResponseCookie.from("jwt", token)
              .httpOnly(true)
              .secure(false)
              .path("/")
              .maxAge(Duration.ofDays(expirationDays))
              .sameSite("Strict")
              .build();

          response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
          getRedirectStrategy().sendRedirect(request, response, redirectUri);
      }
  }
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add backend/src/main/java/com/christmaslightmap/security/OAuth2SuccessHandler.java
  git commit -m "feat: add OAuth2SuccessHandler (issues JWT cookie and redirects to Angular)"
  ```

---

## Task 15: JwtAuthFilter

**Files:**
- Create: `backend/src/main/java/com/christmaslightmap/security/JwtAuthFilter.java`

- [ ] **Step 1: Create JwtAuthFilter.java**

  ```java
  package com.christmaslightmap.security;

  import jakarta.servlet.FilterChain;
  import jakarta.servlet.ServletException;
  import jakarta.servlet.http.Cookie;
  import jakarta.servlet.http.HttpServletRequest;
  import jakarta.servlet.http.HttpServletResponse;
  import lombok.RequiredArgsConstructor;
  import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
  import org.springframework.security.core.authority.SimpleGrantedAuthority;
  import org.springframework.security.core.context.SecurityContextHolder;
  import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
  import org.springframework.stereotype.Component;
  import org.springframework.web.filter.OncePerRequestFilter;

  import java.io.IOException;
  import java.util.Arrays;
  import java.util.List;

  @Component
  @RequiredArgsConstructor
  public class JwtAuthFilter extends OncePerRequestFilter {

      private final JwtService jwtService;

      @Override
      protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
              FilterChain filterChain) throws ServletException, IOException {

          String token = extractTokenFromCookie(request);

          if (token != null && jwtService.isTokenValid(token)) {
              Long userId = jwtService.getUserId(token);
              String role = jwtService.getRole(token);

              UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                  userId,
                  null,
                  List.of(new SimpleGrantedAuthority("ROLE_" + role))
              );
              auth.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
              SecurityContextHolder.getContext().setAuthentication(auth);
          }

          filterChain.doFilter(request, response);
      }

      private String extractTokenFromCookie(HttpServletRequest request) {
          if (request.getCookies() == null) return null;
          return Arrays.stream(request.getCookies())
              .filter(c -> "jwt".equals(c.getName()))
              .map(Cookie::getValue)
              .findFirst()
              .orElse(null);
      }
  }
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add backend/src/main/java/com/christmaslightmap/security/JwtAuthFilter.java
  git commit -m "feat: add JwtAuthFilter (reads jwt cookie and sets SecurityContext)"
  ```

---

## Task 16: CorsConfig + StorageConfig

**Files:**
- Create: `backend/src/main/java/com/christmaslightmap/config/CorsConfig.java`
- Create: `backend/src/main/java/com/christmaslightmap/config/StorageConfig.java`

- [ ] **Step 1: Create CorsConfig.java**

  ```java
  package com.christmaslightmap.config;

  import org.springframework.beans.factory.annotation.Value;
  import org.springframework.context.annotation.Bean;
  import org.springframework.context.annotation.Configuration;
  import org.springframework.web.cors.CorsConfiguration;
  import org.springframework.web.cors.CorsConfigurationSource;
  import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

  import java.util.List;

  @Configuration
  public class CorsConfig {

      @Value("${app.cors.allowed-origins}")
      private String allowedOrigins;

      @Bean
      public CorsConfigurationSource corsConfigurationSource() {
          CorsConfiguration config = new CorsConfiguration();
          config.setAllowedOrigins(List.of(allowedOrigins.split(",")));
          config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
          config.setAllowedHeaders(List.of("*"));
          config.setAllowCredentials(true);

          UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
          source.registerCorsConfiguration("/**", config);
          return source;
      }
  }
  ```

- [ ] **Step 2: Create StorageConfig.java**

  ```java
  package com.christmaslightmap.config;

  import org.springframework.beans.factory.annotation.Value;
  import org.springframework.context.annotation.Bean;
  import org.springframework.context.annotation.Configuration;
  import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
  import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
  import software.amazon.awssdk.regions.Region;
  import software.amazon.awssdk.services.s3.S3Client;

  import java.net.URI;

  @Configuration
  public class StorageConfig {

      @Value("${app.r2.endpoint}")
      private String endpoint;

      @Value("${app.r2.access-key}")
      private String accessKey;

      @Value("${app.r2.secret-key}")
      private String secretKey;

      @Bean
      public S3Client s3Client() {
          return S3Client.builder()
              .endpointOverride(URI.create(endpoint))
              .credentialsProvider(StaticCredentialsProvider.create(
                  AwsBasicCredentials.create(accessKey, secretKey)))
              .region(Region.US_EAST_1)
              .build();
      }
  }
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add backend/src/main/java/com/christmaslightmap/config/
  git commit -m "feat: add CorsConfig and StorageConfig (S3Client for Cloudflare R2)"
  ```

---

## Task 17: SecurityConfig

**Files:**
- Create: `backend/src/main/java/com/christmaslightmap/config/SecurityConfig.java`

- [ ] **Step 1: Create SecurityConfig.java**

  ```java
  package com.christmaslightmap.config;

  import com.christmaslightmap.security.JwtAuthFilter;
  import com.christmaslightmap.security.OAuth2SuccessHandler;
  import com.christmaslightmap.security.OAuth2UserService;
  import lombok.RequiredArgsConstructor;
  import org.springframework.context.annotation.Bean;
  import org.springframework.context.annotation.Configuration;
  import org.springframework.http.HttpMethod;
  import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
  import org.springframework.security.config.annotation.web.builders.HttpSecurity;
  import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
  import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
  import org.springframework.security.config.http.SessionCreationPolicy;
  import org.springframework.security.web.SecurityFilterChain;
  import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

  import static org.springframework.security.config.Customizer.withDefaults;

  @Configuration
  @EnableWebSecurity
  @EnableMethodSecurity
  @RequiredArgsConstructor
  public class SecurityConfig {

      private final OAuth2UserService oauth2UserService;
      private final OAuth2SuccessHandler oauth2SuccessHandler;
      private final JwtAuthFilter jwtAuthFilter;

      @Bean
      public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
          http
              .csrf(AbstractHttpConfigurer::disable)
              .cors(withDefaults())
              .sessionManagement(session ->
                  session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
              .authorizeHttpRequests(auth -> auth
                  .requestMatchers("/oauth2/**", "/login/**").permitAll()
                  .requestMatchers(HttpMethod.GET, "/api/v1/displays/**").permitAll()
                  .requestMatchers(HttpMethod.GET, "/api/v1/tags").permitAll()
                  .requestMatchers("/api/v1/admin/**").hasRole("ADMIN")
                  .anyRequest().authenticated()
              )
              .oauth2Login(oauth2 -> oauth2
                  .userInfoEndpoint(userInfo -> userInfo.userService(oauth2UserService))
                  .successHandler(oauth2SuccessHandler)
              )
              .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

          return http.build();
      }
  }
  ```

- [ ] **Step 2: Start app and verify it boots without errors**

  ```bash
  source .env && cd backend && ./mvnw spring-boot:run
  ```

  Expected: application starts on port 8080 with no exceptions. Stop with Ctrl+C.

- [ ] **Step 3: Commit**

  ```bash
  git add backend/src/main/java/com/christmaslightmap/config/SecurityConfig.java
  git commit -m "feat: add SecurityConfig (Spring Security filter chain with OAuth2 and JWT)"
  ```

---

## Task 18: DTOs + AuthController

**Files:**
- Create: `backend/src/main/java/com/christmaslightmap/dto/response/ApiResponse.java`
- Create: `backend/src/main/java/com/christmaslightmap/dto/response/UserResponse.java`
- Create: `backend/src/main/java/com/christmaslightmap/controller/AuthController.java`

- [ ] **Step 1: Create ApiResponse.java**

  ```java
  package com.christmaslightmap.dto.response;

  import lombok.*;

  @Data
  @Builder
  @NoArgsConstructor
  @AllArgsConstructor
  public class ApiResponse<T> {

      private boolean success;
      private T data;
      private String message;

      public static <T> ApiResponse<T> success(T data) {
          return ApiResponse.<T>builder()
              .success(true)
              .data(data)
              .build();
      }

      public static <T> ApiResponse<T> error(String message) {
          return ApiResponse.<T>builder()
              .success(false)
              .message(message)
              .build();
      }
  }
  ```

- [ ] **Step 2: Create UserResponse.java**

  ```java
  package com.christmaslightmap.dto.response;

  import com.christmaslightmap.model.User;
  import lombok.Builder;
  import lombok.Data;

  @Data
  @Builder
  public class UserResponse {

      private Long id;
      private String email;
      private String name;
      private String avatarUrl;
      private String role;

      public static UserResponse from(User user) {
          return UserResponse.builder()
              .id(user.getId())
              .email(user.getEmail())
              .name(user.getName())
              .avatarUrl(user.getAvatarUrl())
              .role(user.getRole().name())
              .build();
      }
  }
  ```

- [ ] **Step 3: Create AuthController.java**

  ```java
  package com.christmaslightmap.controller;

  import com.christmaslightmap.dto.response.ApiResponse;
  import com.christmaslightmap.dto.response.UserResponse;
  import com.christmaslightmap.model.User;
  import com.christmaslightmap.repository.UserRepository;
  import jakarta.servlet.http.HttpServletResponse;
  import lombok.RequiredArgsConstructor;
  import org.springframework.http.HttpHeaders;
  import org.springframework.http.HttpStatus;
  import org.springframework.http.ResponseCookie;
  import org.springframework.http.ResponseEntity;
  import org.springframework.security.core.Authentication;
  import org.springframework.web.bind.annotation.*;
  import org.springframework.web.server.ResponseStatusException;

  @RestController
  @RequestMapping("/api/v1/auth")
  @RequiredArgsConstructor
  public class AuthController {

      private final UserRepository userRepository;

      @GetMapping("/me")
      public ResponseEntity<ApiResponse<UserResponse>> getMe(Authentication authentication) {
          if (authentication == null || !authentication.isAuthenticated()) {
              return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                  .body(ApiResponse.error("Not authenticated"));
          }

          Long userId = (Long) authentication.getPrincipal();
          User user = userRepository.findById(userId)
              .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));

          return ResponseEntity.ok(ApiResponse.success(UserResponse.from(user)));
      }

      @PostMapping("/logout")
      public ResponseEntity<ApiResponse<Void>> logout(HttpServletResponse response) {
          ResponseCookie cookie = ResponseCookie.from("jwt", "")
              .httpOnly(true)
              .path("/")
              .maxAge(0)
              .sameSite("Strict")
              .build();
          response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
          return ResponseEntity.ok(ApiResponse.success(null));
      }
  }
  ```

- [ ] **Step 4: Verify /auth/me returns 401 without a cookie**

  Start the app:
  ```bash
  source .env && cd backend && ./mvnw spring-boot:run
  ```

  In a separate terminal:
  ```bash
  curl -s http://localhost:8080/api/v1/auth/me
  ```

  Expected: HTTP 401 response (Spring Security intercepts before the controller).

  Stop the app with Ctrl+C.

- [ ] **Step 5: Commit**

  ```bash
  git add backend/src/main/java/com/christmaslightmap/dto/ \
           backend/src/main/java/com/christmaslightmap/controller/AuthController.java
  git commit -m "feat: add ApiResponse, UserResponse DTOs and AuthController (/auth/me, /auth/logout)"
  ```

---

## Task 19: Integration Test — AuthControllerTest

**Files:**
- Create: `backend/src/test/resources/application-test.properties`
- Create: `backend/src/test/java/com/christmaslightmap/AuthControllerTest.java`

- [ ] **Step 1: Create application-test.properties**

  ```properties
  spring.security.oauth2.client.registration.google.client-id=test-client-id
  spring.security.oauth2.client.registration.google.client-secret=test-client-secret
  spring.security.oauth2.client.registration.facebook.client-id=test-client-id
  spring.security.oauth2.client.registration.facebook.client-secret=test-client-secret
  app.jwt.secret=test-secret-key-that-is-at-least-32-characters-long!!
  app.jwt.expiration-days=7
  app.r2.endpoint=https://test.r2.cloudflarestorage.com
  app.r2.bucket=test-bucket
  app.r2.access-key=test-access-key
  app.r2.secret-key=test-secret-key
  app.cors.allowed-origins=http://localhost:4200
  app.oauth2.redirect-uri=http://localhost:4200
  ```

- [ ] **Step 2: Write the failing tests**

  Create `backend/src/test/java/com/christmaslightmap/AuthControllerTest.java`:

  ```java
  package com.christmaslightmap;

  import com.christmaslightmap.model.User;
  import com.christmaslightmap.model.UserRole;
  import com.christmaslightmap.repository.UserRepository;
  import com.christmaslightmap.security.JwtService;
  import org.junit.jupiter.api.AfterEach;
  import org.junit.jupiter.api.Test;
  import org.springframework.beans.factory.annotation.Autowired;
  import org.springframework.boot.test.context.SpringBootTest;
  import org.springframework.boot.test.web.client.TestRestTemplate;
  import org.springframework.http.*;
  import org.springframework.test.context.ActiveProfiles;
  import org.springframework.test.context.DynamicPropertyRegistry;
  import org.springframework.test.context.DynamicPropertySource;
  import org.testcontainers.containers.PostgreSQLContainer;
  import org.testcontainers.junit.jupiter.Container;
  import org.testcontainers.junit.jupiter.Testcontainers;

  import static org.assertj.core.api.Assertions.assertThat;

  @SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
  @Testcontainers
  @ActiveProfiles("test")
  class AuthControllerTest {

      @Container
      static PostgreSQLContainer<?> postgres =
          new PostgreSQLContainer<>("postgis/postgis:15-3.3")
              .withDatabaseName("testdb")
              .withUsername("test")
              .withPassword("test");

      @DynamicPropertySource
      static void configureProperties(DynamicPropertyRegistry registry) {
          registry.add("spring.datasource.url", postgres::getJdbcUrl);
          registry.add("spring.datasource.username", postgres::getUsername);
          registry.add("spring.datasource.password", postgres::getPassword);
      }

      @Autowired
      private TestRestTemplate restTemplate;

      @Autowired
      private JwtService jwtService;

      @Autowired
      private UserRepository userRepository;

      @AfterEach
      void cleanUp() {
          userRepository.deleteAll();
      }

      @Test
      void getMe_withoutCookie_returns401() {
          ResponseEntity<String> response =
              restTemplate.getForEntity("/api/v1/auth/me", String.class);
          assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
      }

      @Test
      void getMe_withValidCookie_returns200WithUser() {
          User user = userRepository.save(User.builder()
              .provider("google")
              .providerId("google-test-123")
              .email("test@example.com")
              .name("Test User")
              .role(UserRole.USER)
              .build());

          String token = jwtService.generateToken(user);

          HttpHeaders headers = new HttpHeaders();
          headers.add("Cookie", "jwt=" + token);
          HttpEntity<Void> request = new HttpEntity<>(headers);

          ResponseEntity<String> response = restTemplate.exchange(
              "/api/v1/auth/me", HttpMethod.GET, request, String.class);

          assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
          assertThat(response.getBody()).contains("test@example.com");
          assertThat(response.getBody()).contains("\"success\":true");
      }

      @Test
      void logout_clearsCookie() {
          User user = userRepository.save(User.builder()
              .provider("google")
              .providerId("google-test-456")
              .email("logout@example.com")
              .name("Logout User")
              .role(UserRole.USER)
              .build());

          String token = jwtService.generateToken(user);
          HttpHeaders headers = new HttpHeaders();
          headers.add("Cookie", "jwt=" + token);
          HttpEntity<Void> request = new HttpEntity<>(headers);

          ResponseEntity<String> response = restTemplate.exchange(
              "/api/v1/auth/logout", HttpMethod.POST, request, String.class);

          assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
          assertThat(response.getHeaders().getFirst(HttpHeaders.SET_COOKIE))
              .contains("jwt=")
              .contains("Max-Age=0");
      }
  }
  ```

- [ ] **Step 3: Run full test suite to confirm all tests pass**

  ```bash
  cd backend && ./mvnw test -q
  ```

  Expected:
  ```
  Tests run: 9, Failures: 0, Errors: 0, Skipped: 0
  ```
  (6 JwtServiceTest + 3 AuthControllerTest)

  Note: First run pulls the `postgis/postgis:15-3.3` Docker image — may take a few minutes.

- [ ] **Step 5: Commit**

  ```bash
  git add backend/src/test/
  git commit -m "test: add AuthControllerTest integration test (401 without cookie, 200 with valid JWT)"
  ```

---

## Task 20: End-to-End Smoke Test

**Files:** None

- [ ] **Step 1: Start Docker and backend**

  ```bash
  # Terminal 1 — repo root
  source .env
  docker-compose up -d
  cd backend && ./mvnw spring-boot:run
  ```

- [ ] **Step 2: Test public endpoint (no auth)**

  ```bash
  curl -s http://localhost:8080/api/v1/auth/me
  ```

  Expected: HTTP 401 (Spring Security rejects unauthenticated request).

- [ ] **Step 3: Initiate Google OAuth flow**

  Open a browser and navigate to:
  ```
  http://localhost:8080/oauth2/authorization/google
  ```

  Complete the Google login flow. You will be redirected to `http://localhost:4200` (the Angular app — which doesn't exist yet, so you'll see "unable to connect", which is expected at this stage).

- [ ] **Step 4: Copy the JWT cookie and call /auth/me**

  In browser DevTools (Application → Cookies → localhost:8080), copy the `jwt` cookie value.

  ```bash
  curl -s -H "Cookie: jwt=<PASTE_TOKEN_HERE>" http://localhost:8080/api/v1/auth/me
  ```

  Expected response:
  ```json
  {
    "success": true,
    "data": {
      "id": 1,
      "email": "your-google-email@gmail.com",
      "name": "Your Name",
      "avatarUrl": "https://...",
      "role": "USER"
    }
  }
  ```

- [ ] **Step 5: Mark Plan 1 complete**

  Backend Foundation is done. Plan 2 (Backend Features) is the next plan to implement.

  ```bash
  git tag plan-1-complete
  ```

---

## Summary

This plan produces a fully functional Spring Boot backend with:
- PostgreSQL + PostGIS schema (10 Flyway migrations)
- All 8 JPA entities mapped and validated
- Google + Facebook OAuth2 login
- JWT issued as HttpOnly cookie on login
- `/api/v1/auth/me` and `/api/v1/auth/logout` endpoints
- Integration tests (Testcontainers, no mocks)

**Next:** Implement `docs/superpowers/plans/2026-04-19-backend-features.md` (Plan 2).
