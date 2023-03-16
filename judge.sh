g++ grader.cpp -o foo -O2 -std=c++17
if (($? == 0)); then
    isAC=1
    for ((i = 1; i <= $count; i++)); do
        ./foo < data/$i.in > out
        diff out data/$i.out
        if (($? != 0)); then $isAC=0; break; fi
        echo "Passed $i of $count test cases"
    done
    if ((isAC)); then echo Accepted; touch Accepted; fi;
    rm out
fi