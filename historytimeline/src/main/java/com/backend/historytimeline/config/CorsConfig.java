package com.backend.historytimeline.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * One central place for CORS rules, instead of scattering @CrossOrigin
 * annotations across individual controllers.
 *
 * NOTE: the allowed origins below are placeholders for local development.
 * Revisit this once phase 3 settles on how index.html is actually served
 * (a local dev server on some port, or opened directly as a file).
 */
@Configuration
public class CorsConfig implements WebMvcConfigurer {

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOrigins("http://localhost:5500", "http://127.0.0.1:5500")
                .allowedMethods("GET");
    }
}
