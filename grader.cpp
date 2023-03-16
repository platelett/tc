// at least C++11
#include <cstdio>
#include <vector>
#include <string>
#include <type_traits>
#include "foo.cc"

namespace graderIO {
template<class T> inline void read(T& res) {
    fread(&res, sizeof(T), 1, stdin);
}
template<> inline void read(std::string& res) {
    size_t size;
    read(size), res.resize(size);
    fread(&res[0], 1, size, stdin);
}
template<class T> inline void read(std::vector<T>& res) {
    size_t size;
    read(size), res.resize(size);
    if(std::is_arithmetic<T>::value) fread(res.data(), sizeof(T), size, stdin);
    else for(auto& i : res) read(i);
}
template<class T> inline void write(const T& res) {
    fwrite(&res, sizeof(T), 1, stdout);
}
template<> inline void write(const std::string& res) {
    write(res.size()), fwrite(res.data(), 1, res.size(), stdout);
}
template<class T> inline void write(const std::vector<T>& res) {
    write(res.size());
    if(std::is_arithmetic<T>::value) fwrite(res.data(), sizeof(T), res.size(), stdout);
    else for(auto&& i : res) write(i);
}
template<class T> inline T read() {
    T res;
    read(res);
    return res;
}
}
