# Stage 1: build the jar with the Maven wrapper. Dependencies are
# resolved in their own layer, so editing source code doesn't re-download
# the whole internet on every build.
FROM eclipse-temurin:25-jdk AS build
WORKDIR /app

COPY .mvn/ .mvn/
COPY mvnw pom.xml ./
# The exec bit may be lost when building from a Windows checkout.
RUN chmod +x mvnw && ./mvnw --batch-mode dependency:go-offline

COPY src/ src/
# Tests need Docker (Testcontainers), which isn't available inside the
# image build -- they run in CI instead.
RUN ./mvnw --batch-mode package -DskipTests

# Stage 2: slim runtime image with just the JRE and the jar.
FROM eclipse-temurin:25-jre
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
